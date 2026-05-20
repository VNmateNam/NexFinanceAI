/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    screens: {
      xs: '375px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0b0f',
          2: '#111217',
          3: '#181920',
          4: '#1e1f28',
        },
        gold: { DEFAULT: '#f5c842', dark: '#e8a820' },
        oil: { DEFAULT: '#4fc3f7', dark: '#0288d1' },
        border: { DEFAULT: 'rgba(255,255,255,0.08)', light: 'rgba(255,255,255,0.13)' },
      },
      fontFamily: {
        sans: ['Syne', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        ticker: 'ticker 35s linear infinite',
      },
      keyframes: {
        ticker: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
      },
    },
  },
  plugins: [],
};
