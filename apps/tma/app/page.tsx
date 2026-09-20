"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Calendar, Clock, Check, Menu, ChevronDown, SearchX, CalendarX2 } from "lucide-react";
import dayjs from "dayjs";
import { getMatches, getCities, getNearbyPitches, getFreeCourts, getJoinableGames } from "@/lib/api";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/lib/auth";
import { useSportStore, setSport, setCity as setStoreCity, type Sport } from "@/lib/sport-store";
import { showMainButton, hideMainButton, hapticImpact } from "@/lib/telegram";
import { useGeolocation } from "@/lib/use-geolocation";
import { HeroBanner } from "@/components/home/HeroBanner";
import { SectionHeader } from "@/components/home/SectionHeader";
import { GamesTodayCarousel } from "@/components/home/GamesTodayCarousel";
import { OpenMatchesCarousel } from "@/components/home/OpenMatchesCarousel";
import { PitchesCarousel } from "@/components/home/PitchesCarousel";
import { SlotSheet, slotFilterLabel, type SlotFilter } from "@/components/home/SlotSheet";
import { FreeCourtCard } from "@/components/home/FreeCourtCard";
import { deriveSections } from "@/components/home/matchHelpers";
import { initialsOf } from "@/components/home/PhotoOrInitials";

export default function HomePage() {
  const router = useRouter();
  const t = useTranslations("home");
  const tCommon = useTranslations("common");
  const tSports = useTranslations("sports");
  const tNav = useTranslations("nav");
  const { user } = useAuth();
  const { sport, city: storeCity } = useSportStore();
  const sportLabel = tSports(sport === "PADEL" ? "padel" : "football");
  const isPadel = sport === "PADEL";

  const [city, setCity] = useState(storeCity || "Tashkent");
  const [district, setDistrict] = useState("");
  const [date, setDate] = useState("");
  const [spotsOnly, setSpotsOnly] = useState(false);
  const [matchType, setMatchType] = useState(""); // "" | COMPETITIVE | CASUAL
  const [slotFilter, setSlotFilter] = useState<SlotFilter | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [slotOpen, setSlotOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const tSlots = useTranslations("slots");

  // Window bounds derived from the slot filter: explicit slots → min..max+1h,
  // else the chosen preset window. Feeds both the games and free-courts queries.
  const slotWindow = (() => {
    if (!slotFilter) return null;
    if (slotFilter.slots.length > 0) {
      const sorted = [...slotFilter.slots].sort();
      const last = sorted[sorted.length - 1];
      const to = `${String((parseInt(last) + 1) % 24).padStart(2, "0")}:00`;
      return { from: sorted[0], to: to === "00:00" ? "23:59" : to };
    }
    if (slotFilter.from && slotFilter.to) return { from: slotFilter.from, to: slotFilter.to };
    return null;
  })();
  const slotDate = slotFilter?.date ?? "";
  const freeMode = slotFilter?.mode === "free";

  const { data: cities } = useQuery({ queryKey: ["cities"], queryFn: getCities });

  // A slot filter with a date overrides the plain date pill.
  const effectiveDate = slotDate || date;
  // When a time window is chosen, use the availability/games endpoint (it
  // filters by window and counts real open spots); otherwise the normal list.
  const useSlotGames = !!slotWindow || (freeMode === false && !!slotFilter && !!slotDate);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tma-matches", sport, city, district, effectiveDate, slotWindow, spotsOnly, matchType, useSlotGames],
    queryFn: async () => {
      if (useSlotGames) {
        const arr = await getJoinableGames({
          sport,
          date: slotDate || dayjs().format("YYYY-MM-DD"),
          ...(city ? { city } : {}),
          ...(district ? { district } : {}),
          ...(slotWindow ? { from: slotWindow.from, to: slotWindow.to } : {}),
        });
        // Apply padel match-type client-side (availability endpoint is sport-only).
        const filtered = isPadel && matchType ? arr.filter((m: any) => m.matchType === matchType) : arr;
        return { data: filtered, total: filtered.length, page: 1, limit: filtered.length };
      }
      return getMatches({
        sport,
        ...(city ? { city } : {}),
        ...(district ? { district } : {}),
        ...(effectiveDate ? { date: dayjs(effectiveDate).toISOString() } : {}),
        ...(spotsOnly ? { minSpotsAvailable: 1 } : {}),
        ...(isPadel && matchType ? { matchType } : {}),
      });
    },
    enabled: !freeMode,
  });

  // Free courts — only when the "Free courts" mode is selected.
  const { data: freeCourts } = useQuery({
    queryKey: ["free-courts", sport, city, district, slotDate, slotWindow],
    queryFn: () =>
      getFreeCourts({
        sport,
        date: slotDate || dayjs().format("YYYY-MM-DD"),
        ...(city ? { city } : {}),
        ...(district ? { district } : {}),
        ...(slotWindow ? { from: slotWindow.from, to: slotWindow.to } : {}),
      }),
    enabled: freeMode,
  });

  // Pitches near you — live location when granted (distance-sorted), else
  // city/district. Never blocks on the permission prompt.
  const geo = useGeolocation();
  const { data: nearbyPitches } = useQuery({
    queryKey: ["home-pitches", sport, city, district, geo.granted, geo.lat, geo.lng],
    queryFn: () =>
      getNearbyPitches({
        sport,
        ...(geo.granted ? { lat: geo.lat, lng: geo.lng } : { city: city || undefined, district: district || undefined }),
        limit: 10,
      }),
    enabled: geo.asked, // wait for the one-shot geolocation attempt to settle
  });

  useEffect(() => {
    const cleanup = showMainButton(t("hostGame"), () => {
      hapticImpact("medium");
      router.push("/create");
    });
    return () => {
      cleanup();
      hideMainButton();
    };
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const matches = data?.data ?? [];
  const pitches = nearbyPitches ?? [];
  const { hero, open, todaySpots } = deriveSections(matches);
  const noMatches = !hero && todaySpots.length === 0 && open.length === 0;
  const filtersDirty = !!(date || slotFilter || spotsOnly || district || matchType);
  const courts = freeCourts ?? [];

  function clearFilters() {
    setDate("");
    setSlotFilter(null);
    setSpotsOnly(false);
    setDistrict("");
    setMatchType("");
  }

  return (
    <div className="min-h-screen pb-24">
      {/* App header */}
      <header
        className="sticky top-0 z-30 transition-shadow"
        style={{
          background: "var(--tg-bg)",
          borderBottom: scrolled ? "1px solid rgba(0,0,0,0.07)" : "1px solid transparent",
        }}
      >
        <div className="h-14 px-4 flex items-center justify-between">
          <button
            aria-label={t("selectLocation")}
            onClick={() => {
              hapticImpact("light");
              setMenuOpen(true);
            }}
            className="w-9 h-9 -ml-1 flex items-center justify-center rounded-full active:scale-95 transition-transform"
            style={{ color: "var(--tg-text)" }}
          >
            <Menu size={22} />
          </button>

          <div className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-512.png" alt="" width={24} height={24} className="rounded-md" style={{ width: 24, height: 24 }} />
            <div className="text-lg font-semibold tracking-tight">
              <span className="text-[#00C853]">Expo</span>
              <span style={{ color: "var(--tg-text)" }}>Uz</span>
            </div>
          </div>

          <button
            aria-label={tNav("profile")}
            onClick={() => {
              hapticImpact("light");
              router.push("/profile");
            }}
            className="w-8 h-8 rounded-full overflow-hidden active:scale-95 transition-transform bg-[#00C853]/15 text-[#00875A] flex items-center justify-center text-xs font-bold"
          >
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              initialsOf(`${user?.firstName ?? ""} ${user?.lastName ?? ""}`)
            )}
          </button>
        </div>

        {/* Filter chip row */}
        <div className="flex gap-2 overflow-x-auto snap-x px-4 pb-2.5">
          <label className={`pill ${date ? "pill-active" : ""}`}>
            <Calendar size={15} />
            <span>{date ? dayjs(date).format("MMM D") : t("date")}</span>
            <input
              type="date"
              value={date}
              min={dayjs().format("YYYY-MM-DD")}
              onChange={(e) => setDate(e.target.value)}
              className="absolute inset-0 opacity-0"
            />
          </label>
          <button
            className={`pill ${slotFilter ? "pill-active" : ""}`}
            onClick={() => {
              hapticImpact("light");
              setSlotOpen(true);
            }}
          >
            <Clock size={15} />
            <span>{slotFilter ? slotFilterLabel(slotFilter, tSlots) : t("time")}</span>
            {slotFilter && <ChevronDown size={14} className="ml-0.5" />}
          </button>
          {isPadel && (
            <>
              <button
                className={`pill ${matchType === "COMPETITIVE" ? "pill-active" : ""}`}
                onClick={() => {
                  hapticImpact("light");
                  setMatchType((v) => (v === "COMPETITIVE" ? "" : "COMPETITIVE"));
                }}
              >
                <span>{t("competitive")}</span>
              </button>
              <button
                className={`pill ${matchType === "CASUAL" ? "pill-active" : ""}`}
                onClick={() => {
                  hapticImpact("light");
                  setMatchType((v) => (v === "CASUAL" ? "" : "CASUAL"));
                }}
              >
                <span>{t("casual")}</span>
              </button>
            </>
          )}
          <button
            className={`pill ${spotsOnly ? "pill-active" : ""}`}
            onClick={() => {
              hapticImpact("light");
              setSpotsOnly((v) => !v);
            }}
          >
            <span>{t("spotsAvailable")}</span>
          </button>
          {filtersDirty && (
            <button className="pill" onClick={clearFilters}>
              {t("clear")}
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <main className="pt-3">
        {freeMode ? (
          // ── Free courts mode ──
          <div className="space-y-3">
            <SectionHeader title={tSlots("freeCourtsTitle")} />
            {courts.length === 0 ? (
              <div className="text-center py-14 px-8">
                <div className="flex justify-center mb-3">
                  <CalendarX2 size={32} style={{ color: "var(--tg-hint)" }} />
                </div>
                <p className="font-medium">{tSlots("noFreeCourts")}</p>
                <button onClick={() => setSlotOpen(true)} className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold bg-[#00C853] text-white">
                  {tSlots("changeTime")}
                </button>
              </div>
            ) : (
              courts.map((c) => (
                <FreeCourtCard key={c.pitch.id} court={c} date={slotDate || dayjs().format("YYYY-MM-DD")} />
              ))
            )}
          </div>
        ) : isLoading ? (
          <HomeSkeleton />
        ) : isError ? (
          <div className="text-center py-14 px-8">
            <div className="flex justify-center mb-3">
              <SearchX size={32} style={{ color: "var(--tg-hint)" }} />
            </div>
            <p className="font-medium">{tCommon("error")}</p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold bg-[#00C853] text-white"
            >
              {tCommon("retry")}
            </button>
          </div>
        ) : (
          <div className="space-y-7">
            {hero && (
              <div className="section-in" style={{ animationDelay: "0ms" }}>
                <HeroBanner match={hero} />
              </div>
            )}

            {noMatches && (
              <div className="text-center py-14 px-8 section-in" style={{ animationDelay: "40ms" }}>
                <div className="flex justify-center mb-3">
                  <SearchX size={32} style={{ color: "var(--tg-hint)" }} />
                </div>
                <p className="font-medium">{t("noGames", { sport: sportLabel })}</p>
                <p className="text-sm mt-1" style={{ color: "var(--tg-hint)" }}>
                  {t("tryClearing")}
                </p>
                {filtersDirty && (
                  <button
                    onClick={clearFilters}
                    className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold bg-[#00C853] text-white"
                  >
                    {t("clear")}
                  </button>
                )}
              </div>
            )}

            {pitches.length > 0 && (
              <section className="section-in" style={{ animationDelay: "40ms" }}>
                <SectionHeader title={t("pitchesNearYou")} />
                <PitchesCarousel pitches={pitches} />
              </section>
            )}

            {todaySpots.length > 0 && (
              <section className="section-in" style={{ animationDelay: "80ms" }}>
                <SectionHeader title={t("gamesTodayTitle")} />
                <GamesTodayCarousel matches={todaySpots} />
              </section>
            )}

            {open.length > 0 && (
              <section className="section-in" style={{ animationDelay: "120ms" }}>
                <SectionHeader title={t("openMatches")} />
                <OpenMatchesCarousel matches={open} />
              </section>
            )}
          </div>
        )}
      </main>

      {/* Sport + location sheet (opened from the header menu) */}
      {menuOpen && (
        <Sheet title={t("selectLocation")} onClose={() => setMenuOpen(false)}>
          <div className="flex gap-2 mb-4">
            {(["FOOTBALL", "PADEL"] as Sport[]).map((s) => {
              const active = sport === s;
              return (
                <button
                  key={s}
                  onClick={() => {
                    hapticImpact("light");
                    setSport(s);
                    if (s !== "PADEL") setMatchType("");
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  style={{
                    background: active ? "#00C853" : "var(--tg-card)",
                    color: active ? "#fff" : "var(--tg-text)",
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  {tSports(s === "PADEL" ? "padel" : "football")}
                </button>
              );
            })}
          </div>

          {(cities ?? []).map((c) => (
            <div key={c.city} className="mb-2">
              <SheetRow
                label={c.city}
                selected={city === c.city && !district}
                onClick={() => {
                  setCity(c.city);
                  setStoreCity(c.city);
                  setDistrict("");
                  setMenuOpen(false);
                }}
              />
              <div className="pl-3">
                {c.districts.map((d) => (
                  <SheetRow
                    key={d}
                    label={d}
                    small
                    selected={district === d}
                    onClick={() => {
                      setCity(c.city);
                      setStoreCity(c.city);
                      setDistrict(d);
                      setMenuOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
          {(cities ?? []).length === 0 && (
            <p className="text-sm text-center py-6" style={{ color: "var(--tg-hint)" }}>
              {t("noLocations")}
            </p>
          )}
        </Sheet>
      )}

      {/* Slot availability sheet */}
      {slotOpen && (
        <SlotSheet
          sport={sport}
          city={city || undefined}
          district={district || undefined}
          initial={slotFilter}
          onApply={setSlotFilter}
          onClose={() => setSlotOpen(false)}
        />
      )}

      <BottomNav />

      <style jsx>{`
        .pill {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
          padding: 7px 13px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 500;
          background: transparent;
          color: var(--tg-hint);
          border: 1px solid rgba(0, 0, 0, 0.12);
        }
        .pill-active {
          background: rgba(0, 200, 83, 0.12);
          color: #00875a;
          border-color: #00c853;
        }
      `}</style>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-7">
      <div className="mx-4 rounded-2xl skeleton" style={{ aspectRatio: "16 / 10" }} />
      <div>
        <div className="h-4 w-40 mx-4 mb-3 rounded skeleton" />
        <div className="flex gap-3 px-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-[88px] h-[88px] rounded-xl skeleton shrink-0" />
          ))}
        </div>
      </div>
      <div>
        <div className="h-4 w-40 mx-4 mb-3 rounded skeleton" />
        <div className="flex gap-3 px-4">
          {[0, 1].map((i) => (
            <div key={i} className="w-[200px] h-[130px] rounded-2xl skeleton shrink-0" />
          ))}
        </div>
      </div>
    </div>
  );
}

function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full max-h-[70vh] overflow-y-auto rounded-t-3xl p-4 animate-sheet-up"
        style={{
          background: "var(--tg-bg)",
          paddingBottom: "calc(72px + env(safe-area-inset-bottom))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-bold text-base mb-3">{title}</div>
        {children}
      </div>
    </div>
  );
}

function SheetRow({
  label,
  selected,
  small,
  onClick,
}: {
  label: string;
  selected?: boolean;
  small?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between rounded-xl px-3 ${
        small ? "py-2 text-sm" : "py-2.5"
      }`}
      style={{ color: selected ? "#00C853" : "var(--tg-text)" }}
    >
      <span>{label}</span>
      {selected && <Check size={16} />}
    </button>
  );
}
