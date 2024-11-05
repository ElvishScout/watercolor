import plugin from "tailwindcss/plugin";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        "stroke": {
          from: {
            "stroke-dashoffset": 0,
          },
          to: {
            "stroke-dashoffset": 8,
          },
        },
      },
      animation: {
        "stroke": "stroke 0.5s linear 0s infinite reverse none",
      },
    },
  },
  plugins: [plugin(({ addVariant }) => {})],
};
