import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#030405",
        bone: "#f4f2ec",
        ash: "#9aa1a9",
        blood: "#8f1d1d",
        ember: "#d8b15d",
        moss: "#5b7567",
        glass: "rgba(255,255,255,0.055)",
        line: "rgba(255,255,255,0.12)"
      },
      borderRadius: {
        crm: "8px"
      },
      boxShadow: {
        glass: "0 18px 70px rgba(0,0,0,0.42)",
        glow: "0 0 42px rgba(216,177,93,0.16)"
      },
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui"],
        display: ["var(--font-display)", "Georgia", "serif"]
      }
    }
  },
  plugins: []
};

export default config;
