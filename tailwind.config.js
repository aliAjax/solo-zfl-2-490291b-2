/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
    },
    extend: {
      colors: {
        ink: {
          950: "#0e0e11",
          900: "#1a1a1e",
          800: "#25252b",
          700: "#32323a",
          600: "#45454f",
          500: "#5a5a66",
          400: "#7a7a88",
          300: "#9a9aa8",
          200: "#c0bfb9",
          100: "#dcdbd4",
          50: "#eeece4",
        },
        brass: {
          50: "#fbf4e8",
          100: "#f3e2be",
          200: "#e9c989",
          300: "#d4944a",
          400: "#c07a2a",
          500: "#a0601d",
        },
        moss: {
          400: "#8bb078",
          500: "#6b8e5a",
          600: "#4f6e41",
        },
        wine: {
          400: "#c27575",
          500: "#a65252",
          600: "#853a3a",
        },
        slateblue: {
          400: "#7a8bb0",
          500: "#5a6b8e",
          600: "#435270",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px -4px rgba(212, 148, 74, 0.4)",
        card: "0 4px 20px -6px rgba(0, 0, 0, 0.5), 0 1px 3px rgba(0, 0, 0, 0.3)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(212,148,74,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(212,148,74,0.04) 1px, transparent 1px)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(212, 148, 74, 0.4)" },
          "50%": { boxShadow: "0 0 0 6px rgba(212, 148, 74, 0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.35s ease-out both",
        scaleIn: "scaleIn 0.25s ease-out both",
        pulseGlow: "pulseGlow 2s infinite",
      },
    },
  },
  plugins: [],
};
