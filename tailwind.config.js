/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    colors: {
      text: '#cad3f5',
      background: '#494d64',
      sbackground: '#6e738d',
      primary: '#b7bdf8',
      secondary: '#7dc4e4',
      accent: '#f0c6c6',
    },
    extend: {
      fontFamily: {
        sans: ['Overpass', 'sans-serif'],
      },
    },
    plugins: [],
  },
};
