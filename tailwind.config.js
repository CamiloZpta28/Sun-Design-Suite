/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta extraída del logo de Sun Design Suite
        gold: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE9A0',
          300: '#FCDB66',
          400: '#FCC93C',
          500: '#FCBB1F', // dorado principal del logo
          600: '#E0A30F',
          700: '#B9840C',
          800: '#8F660D',
          900: '#6B4D0E',
        },
        navy: {
          50: '#F2F4F7',
          100: '#E4E8EE',
          200: '#C7D0DB',
          300: '#A2AFC1',
          400: '#7A899E',
          500: '#5A6A80',
          600: '#465468',
          700: '#364357', // azul-gris principal del logo
          800: '#28323F',
          900: '#1A212B',
        },
      },
      fontFamily: {
        sans: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
