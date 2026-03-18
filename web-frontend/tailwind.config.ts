import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#B40808',
          50: '#FEF2F2',
          100: '#FDE3E3',
          200: '#FBCBCB',
          300: '#F8A5A5',
          400: '#F27070',
          500: '#E63E3E',
          600: '#D32424',
          700: '#B40808',
          800: '#8C1010',
          900: '#751414',
        },
        secondary: '#FFFFFF',
      },
    },
  },
  plugins: [],
};

export default config;
