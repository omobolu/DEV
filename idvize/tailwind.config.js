/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'surface-950': '#0a0f1e',
        'surface-900': '#0f172a',
        'surface-800': '#1e293b',
        'surface-700': '#334155',
        'surface-600': '#475569',
        'surface-500': '#64748b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
