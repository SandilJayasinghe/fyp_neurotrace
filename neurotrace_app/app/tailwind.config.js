/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        risk: {
          low:      '#22c55e',  // green-500
          moderate: '#f59e0b',  // amber-500
          elevated: '#ef4444',  // red-500
        },
        brand: {
          50:  '#f0f4ff',
          500: '#4f6ef7',
          600: '#3b5bdb',
          700: '#2b45b0',
          900: '#1e2d6b',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'shake': 'shake 0.5s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shake: {
            '0%, 100%': { transform: 'rotate(0)' },
            '25%': { transform: 'rotate(-10deg)' },
            '75%': { transform: 'rotate(10deg)' },
        }
      },
    },
  },
  plugins: [],
}
