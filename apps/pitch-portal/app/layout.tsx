import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import { PortalShell } from "@/components/PortalShell";

export const metadata: Metadata = {
  title: "ExpoUz — Pitch Owner Portal",
  description: "Manage your pitches, matches, players and revenue on ExpoUz",
};

export const viewport: Viewport = {
  themeColor: "#00A651",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#F5F6F8]">
        <Providers>
          <PortalShell>{children}</PortalShell>
        </Providers>
      </body>
    </html>
  );
}
