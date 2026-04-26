---
name: new-page
description: Scaffold a new frontend page with routing and sidebar entry
user-invocable: true
---

# Scaffold a New Frontend Page

When the user asks to create a new page, follow these steps:

1. **Ask** for the page name, route path, and which sidebar section it belongs to (if not provided)

2. **Read templates** — Read an existing page to match patterns:
   - `idvize/src/pages/documents/DocumentsPage.tsx` (data-fetching page)
   - `idvize/src/pages/stubs/StubPage.tsx` (simple placeholder)
   - `idvize/src/components/layout/Sidebar.tsx` (navigation structure)

3. **Create page component** at `idvize/src/pages/<module>/<PageName>.tsx`:
   - Default export functional component
   - Use `@/lib/apiClient` for data fetching if needed
   - Follow dark theme styling: `bg-surface-800`, `text-slate-100`, `border-surface-700`
   - Use Lucide icons for visual elements

4. **Add route** in `idvize/src/App.tsx`:
   - Import the component
   - Add `<Route path="/<path>" element={<PageName />} />` inside the authenticated layout

5. **Add sidebar entry** in `idvize/src/components/layout/Sidebar.tsx`:
   - Choose appropriate Lucide icon
   - Add NavLink in the correct section
   - Follow existing `isActive` styling pattern

6. **Wire up API calls** if the page needs backend data:
   - Use `apiFetch()` in a `useEffect`
   - Handle loading and error states
   - Follow the pattern: `apiFetch('/endpoint').then(r => r.json()).then(j => { if (j.success) setData(j.data) })`

## Execution Behavior

- Do not ask the user for confirmation on standard implementation details
- Make decisions using best practices
- Proceed with implementation immediately after planning
