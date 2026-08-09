/* eslint-disable @next/next/no-img-element */
/** The ExpoUz app icon, served from /public/icon-512.png. */
export function Logo({ size = 64, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/icon-512.png"
      alt="ExpoUz"
      width={size}
      height={size}
      className={`rounded-2xl ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
