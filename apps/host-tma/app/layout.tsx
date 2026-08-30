import type { Metadata } from 'next';
import { QueryProvider } from './query-provider';
import { HostAuthProvider } from '../lib/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'ExpoUz Host — Stadium Ops',
  description: 'Manage your pitch, schedule, and revenue',
  themeColor: '#090E0C',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body>
        <QueryProvider>
          <HostAuthProvider>
            {children}
          </HostAuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
