/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary:        "rgb(var(--color-primary) / <alpha-value>)",
        "primary-dark": "rgb(var(--color-primary-dark) / <alpha-value>)",
        ink:            "rgb(var(--color-ink) / <alpha-value>)",
        surface:        "#FFFFFF",
        bg:             "rgb(var(--color-bg) / <alpha-value>)",
        muted:          "#6B7280",
        border:         "#E5E7EB",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
