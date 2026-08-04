## Project

Always use Context7 when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

Smart Hotel Reservation and Recommendation System. React + Tailwind CSS frontend, Flask + Python backend (not yet wired). Frontend-only for now.

## Commands

- `npm run dev` — Vite dev server on localhost:5173
- `npm run build` — `tsc -b && vite build`
- `npm run lint` — oxlint (not ESLint)
- No test framework configured yet

## Stack

React 19, TypeScript ~6.0, Vite 8, Tailwind CSS 4, Shadcn/UI components, React Router v7.

## Critical Gotchas

**Tailwind v4 radius variables are non-standard.** `--radius-xl` is 32px (not 12px). If you want 12px corners, use `rounded-[12px]` (arbitrary value), NOT `rounded-xl`.

**Button component uses `@base-ui/react`**, not `@radix-ui/react`. The `cva` variants apply their own classes that can override your className. Use `!` prefix (e.g. `!rounded-[12px]`) to force overrides.

**Auth pages hide header/footer.** `/login` and `/register` render without Header or Footer — controlled in `RootLayout.tsx` via `hideHeaderFooter` array.

**Path alias:** `@` → `src/` (configured in vite.config.ts).

## Design Tokens

All defined in `src/styles/index.css` under `@theme`:
- **Colors:** `--color-primary` (#82285f Royal Plum), `--color-secondary` (#455d58 Forest Teal), `--color-canvas` (#FBF9F4 warm off-white)
- **Fonts:** `--font-family-display` (Playfair Display), `--font-family-body` (Lato)
- **Spacing:** 8px base system (`--spacing-sm` 8px through `--spacing-section` 64px)
- **Shadows:** Single tier via `--shadow-card-hover`

## Structure

```
src/
  pages/        — Home, Rooms, RoomDetail, Login, Register, NotFound
  components/
    ui/         — Shadcn/UI primitives (button, card, dropdown-menu, sheet, avatar)
    layout/     — Header, Footer, MobileNav
    home/       — SearchBar, HeroCarousel
    rooms/      — RoomCard, SearchFilters
  layouts/      — RootLayout (conditional header/footer)
  data/         — Mock room data (rooms.ts)
  styles/       — Tailwind CSS 4 theme + typography classes
  lib/          — cn() utility (clsx + tailwind-merge)
```

## Navigation

- **Public:** Home, Rooms, Sign In
- **Guest:** Home, Rooms, My Bookings, Account (dropdown)
- **Admin:** Only visible inside Account dropdown

## Current Phase

Phase 1 (UI/UX Foundation) complete. Phase 3 (Room Search & Booking) complete. Backend integration pending.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
