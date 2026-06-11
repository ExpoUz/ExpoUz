"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Calendar, Clock, Check } from "lucide-react";
import dayjs from "dayjs";
import { getMatches, getCities } from "@/lib/api";
import { MatchCard } from "@/components/MatchCard";
import { BottomNav } from "@/components/BottomNav";
import { showMainButton, hideMainButton, hapticImpact } from "@/lib/telegram";

const TIMES = [
  { key: "", label: "Any time" },
  { key: "MORNING", label: "🌅 Morning" },
  { key: "AFTERNOON", label: "☀️ Afternoon" },
  { key: "EVENING", label: "🌆 Evening" },
];

export default function HomePage() {
  const router = useRouter();
  const [city, setCity] = useState("Tashkent");
  const [district, setDistrict] = useState("");
  const [date, setDate] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("");
  const [spotsOnly, setSpotsOnly] = useState(false);

  const [cityOpen, setCityOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  const { data: cities } = useQuery({ queryKey: ["cities"], queryFn: getCities });

  const { data, isLoading } = useQuery({
    queryKey: ["tma-matches", city, district, date, timeOfDay, spotsOnly],
    queryFn: () =>
      getMatches({
        sport: "PADEL",
        ...(city ? { city } : {}),
        ...(district ? { district } : {}),
        ...(date ? { date: dayjs(date).toISOString() } : {}),
        ...(timeOfDay ? { timeOfDay } : {}),
        ...(spotsOnly ? { minSpotsAvailable: 1 } : {}),
      }),
  });

  useEffect(() => {
    const cleanup = showMainButton("🎾 Host a Game", () => {
      hapticImpact("medium");
      router.push("/create");
    });
    return () => {
      cleanup();
      hideMainButton();
    };
  }, [router]);

  const matches = data?.data ?? [];

  return (
    <div className="min-h-screen pb-24">
      <header className="px-4 pt-5 pb-3 sticky top-0 z-30" style={{ background: "var(--tg-bg)" }}>
        {/* Sport in City */}
        <div className="flex items-center gap-2 flex-wrap">
          <button className="dropdown" disabled>
            <span>🎾</span>
            <span className="font-bold">Padel</span>
          </button>
          <span className="text-sm" style={{ color: "var(--tg-hint)" }}>in</span>
          <button
            className="dropdown"
            onClick={() => {
              hapticImpact("light");
              setCityOpen(true);
            }}
          >
            <span className="font-bold">{district || city}</span>
            <ChevronDown size={16} />
          </button>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto mt-3 -mx-4 px-4 pb-1">
          <label className={`pill ${date ? "pill-active" : ""}`}>
            <Calendar size={15} />
            <span>{date ? dayjs(date).format("MMM D") : "Date"}</span>
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
            <span>{TIMES.find((t) => t.key === timeOfDay)?.label ?? "Time"}</span>
          </button>
          <button
            className={`pill ${spotsOnly ? "pill-active" : ""}`}
            onClick={() => {
              hapticImpact("light");
              setSpotsOnly((v) => !v);
            }}
          >
            <span>Spots available</span>
          </button>
          {(date || timeOfDay || spotsOnly || district) && (
            <button
              className="pill"
              onClick={() => {
                setDate("");
                setTimeOfDay("");
                setSpotsOnly(false);
                setDistrict("");
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>
      </header>

      {/* List */}
      <div className="px-4 pt-2 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <span className="w-6 h-6 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-2">🎾</div>
            <p className="font-medium">No padel games match your filters</p>
            <p className="text-sm mt-1" style={{ color: "var(--tg-hint)" }}>
              Try clearing filters — or host one!
            </p>
          </div>
        ) : (
          matches.map((m: any) => <MatchCard key={m.id} match={m} />)
        )}
      </div>

      {/* City bottom sheet */}
      {cityOpen && (
        <Sheet title="Select location" onClose={() => setCityOpen(false)}>
          {(cities ?? []).map((c) => (
            <div key={c.city} className="mb-2">
              <SheetRow
                label={c.city}
                selected={city === c.city && !district}
                onClick={() => {
                  setCity(c.city);
                  setDistrict("");
                  setCityOpen(false);
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
                      setDistrict(d);
                      setCityOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
          {(cities ?? []).length === 0 && (
            <p className="text-sm text-center py-6" style={{ color: "var(--tg-hint)" }}>
              No locations yet.
            </p>
          )}
        </Sheet>
      )}

      {/* Time-of-day bottom sheet */}
      {timeOpen && (
        <Sheet title="Time of day" onClose={() => setTimeOpen(false)}>
          {TIMES.map((t) => (
            <SheetRow
              key={t.key}
              label={t.label}
              selected={timeOfDay === t.key}
              onClick={() => {
                setTimeOfDay(t.key);
                setTimeOpen(false);
              }}
            />
          ))}
        </Sheet>
      )}

      <BottomNav />

      <style jsx>{`
        .dropdown {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          border-radius: 999px;
          background: var(--tg-card);
          font-size: 15px;
        }
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
          background: var(--tg-card);
          color: var(--tg-hint);
          border: 1px solid rgba(0, 0, 0, 0.08);
        }
        .pill-active {
          background: #00c853;
          color: #fff;
          border-color: #00c853;
        }
      `}</style>
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
        className="w-full max-h-[70vh] overflow-y-auto rounded-t-3xl p-4 pb-8"
        style={{ background: "var(--tg-bg)" }}
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
