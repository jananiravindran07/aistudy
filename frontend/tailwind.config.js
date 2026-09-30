/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pastel: {
          cream: '#FFF8EC',
          peach: '#FFD8BE',
          pink: '#FFC8DD',
          lavender: '#CDB4DB',
          blue: '#BDE0FE',
          mint: '#B8E0D2',
          tan: '#D9A877',
          brown: '#8B5E3C',
          orange: '#FFA552',
        }
      },
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
        display: ['Quicksand', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
