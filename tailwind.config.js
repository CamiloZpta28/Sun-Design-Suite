/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta de marca "Solé": Lemony (lima), Nautical Navy y Nashville (celeste)
        lime: {
          50: '#FAFCF3',
          100: '#F5FAE1',
          200: '#EFFAC2',
          300: '#E2FF65', // Lemony — color principal de marca
          400: '#D9FA47',
          500: '#C2E723',
          600: '#9AB620',
          700: '#758820',
          800: '#59671E',
          900: '#434D19',
        },
        navy: {
          50: '#F6F7F9',
          100: '#E8ECF2',
          200: '#CBD5E6',
          300: '#9BB0D4',
          400: '#6487C4',
          500: '#3C64AA',
          600: '#2A497E',
          700: '#1D345D',
          800: '#152644', // Nautical Navy — color principal de marca
          900: '#0D182B',
        },
        nashville: {
          50: '#F5F8FA',
          100: '#E5F0F5',
          200: '#C9E1ED',
          300: '#A8D0E6',
          400: '#8CC3E1', // Nashville — celeste de acento
          500: '#61A9D1',
          600: '#378EBE',
          700: '#2C7196',
          800: '#225977',
          900: '#194157',
        },
      },
      fontFamily: {
        sans: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
