/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        mag: { 50:'#fff0f5',100:'#f4e6ed',200:'#f0c0d4',500:'#A7014B',600:'#7d0038',700:'#5a0029' },
        teal: { 100:'#e6f2f7',500:'#3087A6',600:'#246d8a' },
      },
      animation: {
        'slide-up':'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
        'scale-in':'scaleIn 0.2s cubic-bezier(0.16,1,0.3,1)',
        'fly-right':'flyRight 0.4s ease forwards',
        'fly-left':'flyLeft 0.4s ease forwards',
      },
      keyframes: {
        slideUp:  {from:{opacity:0,transform:'translateY(20px)'},to:{opacity:1,transform:'translateY(0)'}},
        scaleIn:  {from:{opacity:0,transform:'scale(0.95)'},to:{opacity:1,transform:'scale(1)'}},
        flyRight: {to:{transform:'translateX(140%) rotate(20deg)',opacity:0}},
        flyLeft:  {to:{transform:'translateX(-140%) rotate(-20deg)',opacity:0}},
      },
    },
  },
  plugins: [],
}
