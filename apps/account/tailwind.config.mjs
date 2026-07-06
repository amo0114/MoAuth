/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ["Fraunces", "serif"],
        artistic: ["Fraunces", "Playfair Display", "serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
        },
        terracotta: {
          DEFAULT: "#C4612F",
          dark: "#A94E22",
          light: "#F2E3D6",
        },
        warm: {
          cream: "#F7F4EF",
          surface: "#FBF9F5",
          line: "#E7E1D7",
          text: "#1F2421",
          muted: "#5C635D",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-4px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(4px)" },
        },
        "marquee": {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-100%)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "aurora-1": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)", opacity: "0.5" },
          "50%": { transform: "translate3d(-5%, 5%, 0) scale(1.2)", opacity: "0.8" },
        },
        "aurora-2": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)", opacity: "0.5" },
          "50%": { transform: "translate3d(5%, -5%, 0) scale(1.1)", opacity: "0.8" },
        },
        "aurora-3": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)", opacity: "0.5" },
          "50%": { transform: "translate3d(-5%, -5%, 0) scale(1.2)", opacity: "0.8" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "gentle-pulse": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.95", transform: "scale(1.02)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "auth-ripple": {
          "0%": { transform: "scale(0.92)", opacity: "0.55" },
          "70%": { opacity: "0.12" },
          "100%": { transform: "scale(1.35)", opacity: "0" },
        },
        "auth-orbit": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "auth-glow-pulse": {
          "0%, 100%": {
            boxShadow: "0 8px 32px rgba(0,122,255,0.18), 0 0 0 0 rgba(0,122,255,0.2)",
          },
          "50%": {
            boxShadow: "0 12px 40px rgba(0,122,255,0.28), 0 0 0 8px rgba(0,122,255,0.08)",
          },
        },
        "auth-phase-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "auth-progress": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(220%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "shake": "shake 0.4s cubic-bezier(.36,.07,.19,.97) both",
        "marquee": "marquee 40s linear infinite",
        "float": "float 3s ease-in-out infinite",
        "aurora-1": "aurora-1 15s ease-in-out infinite",
        "aurora-2": "aurora-2 20s ease-in-out infinite reverse",
        "aurora-3": "aurora-3 18s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.6s cubic-bezier(0.25, 1, 0.5, 1)",
        "gentle-pulse": "gentle-pulse 3s ease-in-out infinite",
        "shimmer": "shimmer 2s ease-in-out infinite",
        "auth-ripple": "auth-ripple 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite",
        "auth-orbit": "auth-orbit 4s linear infinite",
        "auth-glow-pulse": "auth-glow-pulse 2.2s ease-in-out infinite",
        "auth-phase-in": "auth-phase-in 0.45s cubic-bezier(0.25, 1, 0.5, 1) both",
        "auth-progress": "auth-progress 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
  ],
}
