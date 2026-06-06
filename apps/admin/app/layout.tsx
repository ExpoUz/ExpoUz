import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import { AdminShell } from "@/components/AdminShell";

export const metadata: Metadata = {
  title: "ScoreWithUs — Admin",
  description: "Admin panel for ScoreWithUs sports platform",
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
          <AdminShell>{children}</AdminShell>
        </Providers>
      </body>
    </html>
  );
}
