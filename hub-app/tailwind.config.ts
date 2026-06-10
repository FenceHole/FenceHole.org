import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:"#08080f",card:"#111120",hover:"#16162a",
        gold:"#f0b429",blue:"#3b9eff",green:"#34d399",
        teal:"#22d3ee",purple:"#a78bfa",coral:"#fb7185",
        ink:"#f0f0f4",ink2:"#8888aa",ink3:"#44445a",
      },
    },
  },
  plugins: [],
};
export default config;
