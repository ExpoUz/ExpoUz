"use client";

import { useState } from "react";

/**
 * A photo that degrades gracefully: shows a shimmer skeleton while loading, and
 * falls back to a solid brand-tinted block with initials when there is no photo
 * or it fails to load. The whole layout is designed to look intentional with
 * zero images — this component is the guarantee of that.
 */
export function PhotoOrInitials({
  src,
  initials,
  className = "",
  rounded = "",
  initialsClassName = "text-white/90 font-extrabold",
}: {
  src?: string | null;
  initials: string;
  className?: string;
  rounded?: string;
  /** Tailwind classes controlling the initials size/colour (varies per card). */
  initialsClassName?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const showImg = !!src && !failed;

  return (
    <div
      className={`relative overflow-hidden ${rounded} ${className}`}
      style={{
        // Solid brand-tinted fallback behind everything; visible whenever the
        // photo is absent, still loading, or failed.
        background: "linear-gradient(135deg, #00C853 0%, #009C43 100%)",
      }}
    >
      {/* Shimmer only while a real image is still loading */}
      {showImg && !loaded && <div className="absolute inset-0 skeleton" />}

      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center select-none">
          <span className={initialsClassName}>{initials}</span>
        </div>
      )}
    </div>
  );
}

/** First 1–2 letters of a name/phrase, for the initials fallback. */
export function initialsOf(text?: string | null): string {
  if (!text) return "•";
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "•";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
