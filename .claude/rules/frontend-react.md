---
paths:
  - "idvize/src/**/*.{ts,tsx}"
---

# Frontend Development Rules

## Component Pattern
- Functional components only (React 19) — no class components
- Default exports for page components: `export default function PageName()`
- Named exports for shared components: `export function KpiCard()`

## Styling
- Tailwind utility classes only — no inline styles or CSS modules
- Dark theme: `bg-surface-800/900`, `text-slate-100/200/400/500`, `border-surface-700`
- Primary actions: `bg-indigo-600 hover:bg-indigo-500`
- Cards: `bg-surface-800 border border-surface-700 rounded-xl p-5`
- Headings: `text-2xl font-bold text-white` (h1), `text-sm text-slate-500` (subtitle)

## Data Fetching
- Always use `apiFetch()` from `@/lib/apiClient` — never raw `fetch()`
- Fetch in `useEffect` with cleanup; handle loading and error states
- Pattern: `apiFetch('/path').then(r => r.json()).then(j => { if (j.success) setData(j.data) })`

## Routing
- Add routes in `App.tsx` inside the authenticated layout `<Route>` block
- Add sidebar entry in `components/layout/Sidebar.tsx` with a Lucide icon
- Use `useNavigate()` for programmatic navigation

## Icons
- Import from `lucide-react`: `import { IconName } from 'lucide-react'`
- Inline icons: `size={16}`, button icons: `size={20}`

## State Management
- Page-local state: `useState` + `useEffect`
- Shared state: React Context with `useReducer` (see `CMDBContext.tsx`)
- No Redux or Zustand — keep it simple

## Charts
- Use Recharts components from `@/components/charts/`
- Use color constants from `@/constants/colors.ts`
