# Walking Skeleton — Smart Hotel Reservation and Recommendation System

**Phase:** 1
**Generated:** 2026-06-24

## Capability Proven End-to-End

A user can open the application in a browser, see a styled landing page with the hotel brand colors and typography, and click "Rooms" in the header navigation to navigate to a rooms listing page — all within a responsive layout that adapts to desktop, tablet, and mobile viewports.

## Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build tool | Vite 6 + React 19 + TypeScript | CRA is deprecated. Vite is the standard React build tool in 2026 with sub-second HMR. TypeScript is non-negotiable for production. |
| CSS framework | Tailwind CSS 4 (CSS-first config) | Already chosen. v4 uses Vite plugin with `@theme` directive for design tokens instead of JS config file. Backward-compatible with Shadcn/UI via `@layer utilities`. |
| UI component library | Shadcn/UI (Radix-based) | Copy-paste components built on Radix UI primitives with Tailwind styling. No heavy dependency lock-in. Provides accessible Sheet, DropdownMenu, Avatar, Card, Calendar. |
| Icons | Lucide React | Clean, consistent SVG icon set. Lighter than Heroicons. |
| Routing | React Router v7 | Industry standard for React SPA routing. v7 supports type-safe routes. Client-side only in Phase 1 — no loaders/actions (no backend). |
| Design token source | DESIGN.md | Single source of truth for brand colors (#800080 primary, #2F4849 secondary), typography (Montserrat + Cormorant Garamond), spacing (8px base), and component specs. |
| Navigation model | Airbnb mobile-first | Header collapses to hamburger (Shadcn/UI Sheet) below 744px. Full top nav with centered tabs on desktop. Sticky header. |
| Max content width | 1280px centered | Follows DESIGN.md and CONTEXT.md decision D-05. |
| State management (Phase 1) | React built-in (useState/useContext) | Zustand deferred to Phase 3 when real data fetching begins. Phase 1 uses a minimal React context for mock auth state. |
| Deployment target | Vercel (frontend only) | Zero-config for Vite projects. Automatic HTTPS, CDN, preview deployments per branch. Railway/Render deferred to Phase 5 for backend. |
| Directory layout | Feature-based under `src/` | Components organized by concerns: `components/ui/` (Shadcn primitives), `components/layout/` (Header, Footer), `pages/` (route-level components), `lib/` (utilities), `styles/` (global CSS with design tokens), `types/` (TypeScript interfaces). |

## Stack Touched in Phase 1

- [x] Project scaffold — Vite 6 + React 19 + TypeScript, ESLint, Tailwind CSS 4
- [x] Routing — React Router v7 with 4 routes (Home, Rooms, Login, 404)
- [ ] Database — Phase 5 (Supabase). Phase 1 uses local mock data objects.
- [x] UI — Header navigation with clickable links, Footer, responsive hamburger menu
- [x] Deployment — `npm run dev` documented local run command. Vercel deploy configured.

## Out of Scope (Deferred to Later Slices)

- Backend/API layer — Phase 5 (Supabase + Flask)
- Authentication — Phase 2 (login/signup pages are placeholder shells only)
- Real availability data — Phase 3 (room search and booking)
- Admin dashboard — Phase 4 (analytics charts and management)
- Recommendation engine — Phase 6+ (scikit-learn ML models)
- Real payment processing — Phase 7 (or deferred)
- Dark mode — deferred to future enhancement
- Animations/transitions — minimal in Phase 1 (hover states only)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Guest Authentication — Login/Signup flow, session management, protected routes
- Phase 3: Room Search & Booking — Room grid, date picker, booking form with mock data
- Phase 4: Admin Dashboard — Occupancy/revenue charts, bookings table with mock data
- Phase 5: Backend Integration — Supabase persistence, real auth, real data queries
- Phase 6+: Recommendation Engine & Predictive Analytics
