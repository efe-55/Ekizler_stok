/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        serif: ["Fraunces", "Georgia", "serif"],
      },
      colors: {
        // "Kağıt" zemin — sıcak, nötr, standart beyaz/gri temalardan kasıtlı olarak ayrılan bir zemin.
        paper: {
          50: "#FDFCFA",
          100: "#F7F4EE",
          200: "#EFEAE0",
        },
        // Marka rengi — koyu çam yeşili. Nav, birincil butonlar, "yükleme" referans verisi.
        brand: {
          50: "#EAF2EF",
          100: "#CFE3DB",
          200: "#9FC7B7",
          300: "#6FAB93",
          400: "#3F8F6F",
          500: "#1F5D4C",
          600: "#17493C",
          700: "#123B30",
          800: "#0D2C24",
          900: "#0A2019",
          950: "#071813",
        },
        // Hardal/ochre — "Kalan" verisi ve dikkat/uyarı vurguları için ayrı bir kimlik.
        ochre: {
          50: "#FBF3E4",
          100: "#F5E2BC",
          200: "#EACB84",
          300: "#DBAF52",
          400: "#C08A2E",
          500: "#A6741F",
          600: "#8A5F19",
          700: "#6E4B14",
          800: "#52380F",
          900: "#37250A",
        },
      },
    },
  },
  plugins: [],
};
