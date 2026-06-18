"use client";

export function MatchDetailSkeleton() {
  return (
    <div className="min-h-screen pb-28 animate-pulse">
      <div className="h-20" style={{ background: "rgba(0,176,255,0.25)" }} />
      <div className="px-4 -mt-10 space-y-4">
        <Block className="h-28" />
        <div className="flex gap-2">
          <Block className="h-10 flex-1" />
          <Block className="h-10 flex-1" />
        </div>
        <Block className="h-16" />
        <Block className="h-32" />
        <Block className="h-28" />
      </div>
    </div>
  );
}

function Block({ className = "" }: { className?: string }) {
  return <div className={`rounded-2xl ${className}`} style={{ background: "var(--tg-card)" }} />;
}
