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

        /* ── Brand remap: legacy indigo/violet → enterprise navy/blue ──
           Existing class names (bg-indigo-600, text-violet-500, etc.)
           still work but render as enterprise navy/slate.            */
        indigo: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a',
          900: '#172554',
          950: '#0f172a',
        },
        violet: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
