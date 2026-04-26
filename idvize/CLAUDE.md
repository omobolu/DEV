# idvize — Frontend

## Quick Start

```bash
npm install
npm run dev     # vite → http://localhost:5173 (auto-opens browser)
npm run build   # tsc -b && vite build
npm run lint    # eslint
```

## Path Alias

`@/*` maps to `src/*` (configured in `tsconfig.app.json` and `vite.config.ts`).
```typescript
import { apiFetch } from '@/lib/apiClient'
```

## Component Organization

```
src/
├── components/layout/    AppLayout, Sidebar, Header
├── components/common/    KpiCard, DataTable, TabNav, Badge, ChartCard
├── components/charts/    VerticalBarChart, DonutChart, GaugeChart, etc.
├── pages/<module>/       Route-level page components
├── features/<feature>/   Feature modules with co-located components
├── context/              React Context providers (CMDBContext)
├── lib/apiClient.ts      Shared API client
├── types/                TypeScript interfaces
├── constants/colors.ts   Chart color palettes
└── data/                 Mock data for offline dev
```

## Styling Conventions

- Dark mode only — `color-scheme: dark` set globally
- Custom surface colors: `surface-950` (#0a0f1e) through `surface-500` (#64748b)
- Font: Inter (system-ui fallback)
- Card pattern: `bg-surface-800 border border-surface-700 rounded-xl p-5`
- Input pattern: `bg-surface-900 border border-surface-600 rounded-lg px-3 py-2.5 focus:border-indigo-500`
- Primary accent: `indigo-600` / `indigo-500` (hover)
- Icons: Lucide React throughout (`size={16}` for inline, `size={20}` for buttons)

## API Client

All backend calls go through `src/lib/apiClient.ts`:
- `apiFetch(path, init?)` — adds auth headers, handles 401 → redirect to login
- Base URL: `http://localhost:3001`
- Auth: `x-api-key` header + `Authorization: Bearer <token>` from localStorage

localStorage keys: `idvize_token`, `idvize_user`, `idvize_tenant`

## Routing

Routes defined in `App.tsx`. Auth guard: if no `idvize_token` in localStorage, show `LoginPage`.
Default route: `/os` (OS Control Panel). All unmatched routes redirect to `/os`.

## State Management

- **CMDBContext**: `useReducer` + `localStorage` persistence for app catalog state
- No Redux/Zustand — use React Context for new shared state
- Local `useState`/`useEffect` for page-level data fetching
