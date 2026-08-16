import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#00C853",
        danger: "#EF4444",
        warning: "#F59E0B",
        sidebar: "#0D1117",
        background: "#F5F6F8",
        card: "#FFFFFF",
        border: "#E5E7EB",
        muted: "#6B7280",
      },
    },
  },
  plugins: [],
};
export default config;
