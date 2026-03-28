import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Adminty specific colors
        primary: {
          orange: '#FE9365',
          green: '#0AC282',
          pink: '#FE5D70',
          blue: '#01A9AC',
        }
      }
    },
  },
  plugins: [],
};
export default config;
