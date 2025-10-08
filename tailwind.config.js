/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'app-dark': {
          950: '#0A0F1A',
          900: '#111827',
          800: '#1F2937',
          700: '#374151',
        }
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(16, 185, 129, 0.15)',
        'glow': '0 0 20px rgba(16, 185, 129, 0.2)',
        'glow-lg': '0 0 30px rgba(16, 185, 129, 0.3)',
        'glow-xl': '0 0 40px rgba(16, 185, 129, 0.4)',
        'inner-glow': 'inset 0 0 32px rgba(0, 0, 0, 0.37)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(var(--tw-gradient-stops))',
        'gradient-shine': 'linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.1) 50%, transparent 50%, transparent 75%, rgba(255,255,255,0.1) 75%, rgba(255,255,255,0.1))',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': {
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)',
          },
          '50%': {
            boxShadow: '0 0 30px rgba(16, 185, 129, 0.4)',
          },
        },
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}