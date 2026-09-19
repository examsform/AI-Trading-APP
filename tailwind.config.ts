import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0E14",
        panel: "#12171F",
        panel2: "#171D27",
        line: "#232B38",
        text: "#E6EAF0",
        sub: "#8B95A5",
        up: "#3ECF8E",
        down: "#FF5C5C",
        signal: "#E8A33D",
        mockc: "#FF9F43",
      },
      fontFamily: {
        mono: ["SFMono-Regular", "Consolas", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
