/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./context/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brewery: {
          bg: '#1a110d',      // Stout escuro (quase preto)
          card: '#291d18',    // Marrom café
          border: '#452c20',  // Madeira escura
          text: '#fffbeb',    // Espuma (Creme claro)
          muted: '#d6bbaa',   // Bege escuro
          accent: '#f59e0b',  // Âmbar (Cerveja)
          foam: '#ffffff'
        }
      },
      animation: {
        'party-glow': 'party-glow 3s infinite alternate',
        'disco': 'disco 2s infinite',
        'rise': 'rise 4s infinite ease-in',
        'fall': 'fall 4s infinite linear',
        'float': 'float 6s infinite ease-in-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        'party-glow': {
          '0%': { boxShadow: '0 0 10px #f59e0b, 0 0 20px #ef4444' },
          '50%': { boxShadow: '0 0 20px #8b5cf6, 0 0 30px #3b82f6' },
          '100%': { boxShadow: '0 0 10px #10b981, 0 0 20px #f59e0b' },
        },
        'disco': {
          '0%, 100%': { backgroundColor: 'rgba(168, 85, 247, 0.2)' },
          '25%': { backgroundColor: 'rgba(236, 72, 153, 0.2)' },
          '50%': { backgroundColor: 'rgba(59, 130, 246, 0.2)' },
          '75%': { backgroundColor: 'rgba(34, 197, 94, 0.2)' }
        },
        'rise': {
          '0%': { bottom: '-10%', transform: 'translateX(0)', opacity: '0' },
          '20%': { opacity: '0.6' },
          '50%': { transform: 'translateX(20px)', opacity: '0.8' },
          '80%': { opacity: '0.6' },
          '100%': { bottom: '110%', transform: 'translateX(-20px)', opacity: '0' }
        },
        'fall': {
          '0%': { top: '-10%', transform: 'rotate(0deg)' },
          '100%': { top: '110%', transform: 'rotate(360deg)' }
        },
        'float': {
          '0%': { bottom: '-100px', transform: 'translateX(0)' },
          '50%': { transform: 'translateX(20px)' },
          '100%': { bottom: '110vh', transform: 'translateX(-20px)' }
        }
      }
    }
  },
  plugins: [],
}