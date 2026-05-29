/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design system palette
        ds: {
          bg:       '#0A0A0A',
          card:     '#393939',
          card2:    '#1c1c1c',
          border:   '#2D2D2D',
          text:     '#FFFFFF',
          subtext:  '#9CA3AF',
          success:  '#16A34A',
          warning:  '#CA8A04',
        }
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        sans:    ['Inter', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        // spec: heading 24px/600, subtext 14-16px
        'heading': ['24px', { fontWeight: '600', lineHeight: '1.3' }],
        'subtext': ['15px', { lineHeight: '1.5' }],
      },
      borderRadius: {
        // spec: 12px → rounded-xl
        xl: '12px',
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease forwards',
        'slide-up':   'slideUp 0.4s ease forwards',
        'pulse-dot':  'pulseDot 1.5s ease-in-out infinite',
        'shimmer':    'shimmer 1.5s infinite',
        'pop':        'pop 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards',
      },
      keyframes: {
        fadeIn:   { from: { opacity: '0' },                          to: { opacity: '1' } },
        slideUp:  { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulseDot: { '0%,100%': { opacity:'1', transform:'scale(1)' }, '50%': { opacity:'0.5', transform:'scale(1.3)' } },
        shimmer:  { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pop:      { from: { transform: 'scale(0.88)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
      },
      boxShadow: {
        'card':       '0 4px 24px rgba(0, 0, 0, 0.5)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.7)',
        'glow-green': '0 0 20px rgba(22, 163, 74, 0.25)',
        'glow-red':   '0 0 20px rgba(220, 38, 38, 0.25)',
      }
    },
  },
  plugins: [],
}
