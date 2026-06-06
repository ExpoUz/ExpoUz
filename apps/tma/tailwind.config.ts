import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#00C853",
        accent: "#FF5252",
        // Telegram theme variables (with sensible light fallbacks)
        tg: {
          bg: "var(--tg-bg)",
          card: "var(--tg-card)",
          text: "var(--tg-text)",
          hint: "var(--tg-hint)",
          link: "var(--tg-link)",
        },
      },
    },
  },
  plugins: [],
};
export default config;
