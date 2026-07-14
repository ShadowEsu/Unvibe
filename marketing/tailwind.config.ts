import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/data/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        "fg-muted": "rgb(var(--fg-muted) / <alpha-value>)",
        "fg-faint": "rgb(var(--fg-faint) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        "line-strong": "rgb(var(--line-strong) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        "primary-strong": "rgb(var(--primary-strong) / <alpha-value>)",
        "primary-soft": "rgb(var(--primary-soft) / <alpha-value>)",
        "on-primary": "rgb(var(--on-primary) / <alpha-value>)",
        blue: "rgb(var(--blue) / <alpha-value>)",
        green: "rgb(var(--green) / <alpha-value>)",
        orange: "rgb(var(--orange) / <alpha-value>)",
        red: "rgb(var(--red) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Newsreader", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "fluid-sm": "clamp(0.85rem, 0.82rem + 0.15vw, 0.95rem)",
        "fluid-base": "clamp(0.95rem, 0.9rem + 0.25vw, 1.075rem)",
        "fluid-lg": "clamp(1.1rem, 1rem + 0.5vw, 1.35rem)",
        "fluid-xl": "clamp(1.35rem, 1.1rem + 1.1vw, 1.9rem)",
        "fluid-2xl": "clamp(1.8rem, 1.3rem + 2.2vw, 3rem)",
        "fluid-3xl": "clamp(2.4rem, 1.6rem + 3.6vw, 4.4rem)",
        "fluid-4xl": "clamp(2.9rem, 1.9rem + 5vw, 6rem)",
      },
      maxWidth: {
        content: "72rem",
        prose: "40rem",
      },
      borderRadius: {
        card: "16px",
        pill: "999px",
      },
      transitionTimingFunction: {
        calm: "cubic-bezier(0.2, 0, 0.2, 1)",
        emphatic: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      transitionDuration: {
        micro: "150ms",
        standard: "320ms",
        story: "900ms",
      },
      boxShadow: {
        soft: "0 1px 2px rgb(15 12 40 / 0.04), 0 8px 30px rgb(15 12 40 / 0.06)",
        lift: "0 2px 6px rgb(15 12 40 / 0.06), 0 20px 60px rgb(15 12 40 / 0.10)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "caret-blink": {
          "0%, 45%": { opacity: "1" },
          "50%, 95%": { opacity: "0" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "caret-blink": "caret-blink 1s steps(1) infinite",
        marquee: "marquee 40s linear infinite",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
