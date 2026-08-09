import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import Providers from "./providers";
import { AdminShell } from "@/components/AdminShell";

export const metadata: Metadata = {
  title: "ExpoUz — Admin",
  description: "Admin panel for ExpoUz sports platform",
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
      <head>
        {/* Telegram Mini App SDK — enables admin login inside @ExpoUzAdminBot */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className="bg-[#F5F6F8]">
        <Providers>
          <AdminShell>{children}</AdminShell>
        </Providers>
      </body>
    </html>
  );
}
