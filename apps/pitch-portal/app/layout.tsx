import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import { PortalShell } from "@/components/PortalShell";

export const metadata: Metadata = {
  title: "ScoreWithUs — Pitch Owner Portal",
  description: "Manage your pitches, matches, players and revenue on ScoreWithUs",
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
