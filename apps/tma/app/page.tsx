"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Calendar, Clock, Check, Menu } from "lucide-react";
import dayjs from "dayjs";
import { getMatches, getCities, getLeaderboard } from "@/lib/api";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/lib/auth";
import { useSportStore, setSport, setCity as setStoreCity, sportMeta, type Sport } from "@/lib/sport-store";
import { showMainButton, hideMainButton, hapticImpact } from "@/lib/telegram";
import { HeroBanner } from "@/components/home/HeroBanner";
import { SectionHeader } from "@/components/home/SectionHeader";
import { TodayCarousel } from "@/components/home/TodayCarousel";
import { OpenMatchesCarousel } from "@/components/home/OpenMatchesCarousel";
import { PlayersCarousel } from "@/components/home/PlayersCarousel";
import { deriveSections } from "@/components/home/matchHelpers";
import { initialsOf } from "@/components/home/PhotoOrInitials";

const TIME_KEYS = [
  { key: "", label: "anyTime" },
  { key: "MORNING", label: "morning" },
  { key: "AFTERNOON", label: "afternoon" },
  { key: "EVENING", label: "evening" },
] as const;

export default function HomePage() {
  const router = useRouter();
  const t = useTranslations("home");
  const tSports = useTranslations("sports");
  const tNav = useTranslations("nav");
  const { user } = useAuth();
  const { sport, city: storeCity } = useSportStore();
  const meta = sportMeta(sport);
  const sportLabel = tSports(sport === "PADEL" ? "padel" : "football");
  const isPadel = sport === "PADEL";

  const [city, setCity] = useState(storeCity || "Tashkent");
  const [district, setDistrict] = useState("");
  const [date, setDate] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("");
  const [spotsOnly, setSpotsOnly] = useState(false);
  const [matchType, setMatchType] = useState(""); // "" | COMPETITIVE | CASUAL

  const [menuOpen, setMenuOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const { data: cities } = useQuery({ queryKey: ["cities"], queryFn: getCities });

  const { data, isLoading } = useQuery({
    queryKey: ["tma-matches", sport, city, district, date, timeOfDay, spotsOnly, matchType],
    queryFn: () =>
      getMatches({
        sport,
        ...(city ? { city } : {}),
        ...(district ? { district } : {}),
        ...(date ? { date: dayjs(date).toISOString() } : {}),
        ...(timeOfDay ? { timeOfDay } : {}),
        ...(spotsOnly ? { minSpotsAvailable: 1 } : {}),
        // Match type only applies to padel.
        ...(isPadel && matchType ? { matchType } : {}),
      }),
  });

  // Players near you — reuses the leaderboard endpoint, scoped to the city.
  const { data: nearbyPlayers } = useQuery({
    queryKey: ["home-players", city],
    queryFn: () => getLeaderboard(city || undefined),
  });

  useEffect(() => {
    const cleanup = showMainButton(`${meta.icon} ${t("hostGame")}`, () => {
      hapticImpact("medium");
      router.push("/create");
    });
    return () => {
      cleanup();
      hideMainButton();
    };
  }, [router, meta.icon]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const matches = data?.data ?? [];
  const players = (nearbyPlayers ?? []).slice(0, 12);
  const { hero, today, open } = deriveSections(matches);
  const noMatches = !hero && today.length === 0 && open.length === 0;
  const filtersDirty = !!(date || timeOfDay || spotsOnly || district || matchType);

  function clearFilters() {
    setDate("");
    setTimeOfDay("");
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

          <div className="text-lg font-semibold tracking-tight">
            <span className="text-[#00C853]">Expo</span>
            <span style={{ color: "var(--tg-text)" }}>Uz</span>
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
            className={`pill ${timeOfDay ? "pill-active" : ""}`}
            onClick={() => {
              hapticImpact("light");
              setTimeOpen(true);
            }}
          >
            <Clock size={15} />
            <span>
              {(() => {
                const found = TIME_KEYS.find((x) => x.key === timeOfDay);
                return found ? t(found.label) : t("time");
              })()}
            </span>
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
        {isLoading ? (
          <HomeSkeleton />
        ) : (
          <div className="space-y-7">
            {hero && (
              <div className="section-in" style={{ animationDelay: "0ms" }}>
                <HeroBanner match={hero} />
              </div>
            )}

            {noMatches && (
              <div className="text-center py-14 px-8 section-in" style={{ animationDelay: "40ms" }}>
                <div className="text-4xl mb-2">{meta.icon}</div>
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

            {today.length > 0 && (
              <section className="section-in" style={{ animationDelay: "40ms" }}>
                <SectionHeader title={t("happeningToday")} />
                <TodayCarousel matches={today} />
              </section>
            )}

            {open.length > 0 && (
              <section className="section-in" style={{ animationDelay: "80ms" }}>
                <SectionHeader title={t("openMatches")} />
                <OpenMatchesCarousel matches={open} />
              </section>
            )}

            {players.length > 0 && (
              <section className="section-in" style={{ animationDelay: "120ms" }}>
                <SectionHeader
                  title={t("playersNearYou")}
                  onSeeAll={() => router.push("/players")}
                />
                <PlayersCarousel players={players} />
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
                  {sportMeta(s).icon} {tSports(s === "PADEL" ? "padel" : "football")}
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

      {/* Time-of-day sheet */}
      {timeOpen && (
        <Sheet title={t("timeOfDay")} onClose={() => setTimeOpen(false)}>
          {TIME_KEYS.map((x) => (
            <SheetRow
              key={x.key}
              label={t(x.label)}
              selected={timeOfDay === x.key}
              onClick={() => {
                setTimeOfDay(x.key);
                setTimeOpen(false);
              }}
            />
          ))}
        </Sheet>
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
