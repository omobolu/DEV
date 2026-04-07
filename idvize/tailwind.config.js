/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Surface backgrounds (CSS-variable-driven) ─────────── */
        'surface-950': 'rgb(var(--s-bg) / <alpha-value>)',
        'surface-900': 'rgb(var(--s-bg) / <alpha-value>)',
        'surface-800': 'rgb(var(--s-card) / <alpha-value>)',
        'surface-700': 'rgb(var(--s-hover) / <alpha-value>)',
        'surface-600': 'rgb(var(--s-border-strong) / <alpha-value>)',
        'surface-500': 'rgb(var(--s-text-faint) / <alpha-value>)',

        /* ── Semantic text ─────────────────────────────────────── */
        'heading':   'rgb(var(--s-text) / <alpha-value>)',
        'body':      'rgb(var(--s-text-secondary) / <alpha-value>)',
        'secondary': 'rgb(var(--s-text-secondary) / <alpha-value>)',
        'muted':     'rgb(var(--s-text-muted) / <alpha-value>)',
        'faint':     'rgb(var(--s-text-faint) / <alpha-value>)',

        /* ── Theme-aware accent text ───────────────────────────── */
        'a-indigo': 'rgb(var(--s-a-indigo) / <alpha-value>)',
        'a-cyan':   'rgb(var(--s-a-cyan) / <alpha-value>)',
        'a-red':    'rgb(var(--s-a-red) / <alpha-value>)',
        'a-green':  'rgb(var(--s-a-green) / <alpha-value>)',
        'a-amber':  'rgb(var(--s-a-amber) / <alpha-value>)',
        'a-purple': 'rgb(var(--s-a-purple) / <alpha-value>)',
        'a-orange': 'rgb(var(--s-a-orange) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
