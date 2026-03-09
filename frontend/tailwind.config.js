/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#F5F9FF",
          100: "#E8F0FE",
          200: "#A7C7E7",
          300: "#7EB0DC",
          400: "#5A9BD5",
          500: "#4A90E2",
          600: "#3A7BD5",
          700: "#2C5F9E",
          800: "#2C3E50",
          900: "#1A2634",
        },
        accent: {
          50: "#EAFAF1",
          100: "#D0F0DB",
          200: "#A8E6C3",
          300: "#6FCF97",
          400: "#4BB57A",
          500: "#34A062",
          600: "#27804E",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "Tahoma", "sans-serif"],
      },
      boxShadow: {
        panel: "0 4px 24px -8px rgba(74, 144, 226, 0.12)",
        card: "0 1px 3px rgba(44, 62, 80, 0.08), 0 1px 2px rgba(44, 62, 80, 0.06)",
        "card-hover": "0 4px 12px rgba(74, 144, 226, 0.15)",
      },
    },
  },
  plugins: [],
};
