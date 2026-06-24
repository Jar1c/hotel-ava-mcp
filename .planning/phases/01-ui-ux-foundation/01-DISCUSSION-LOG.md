# Phase 1 Discussion Log

**Phase:** UI/UX Foundation
**Date:** 2026-06-24

---

## Areas Discussed

### Layout Style
- **Question:** How should pages be structured per breakpoint?
- **Decision:** Follow Airbnb mobile-first model with collapsing navigation
- **Notes:** Mobile nav collapses to hamburger, desktop has full top nav, sticky header

### Navigation
- **Question:** What goes in the global header/footer?
- **Decision:** 
  - Public routes: Home, Rooms, Login/Sign Up
  - Guest routes: Home, Rooms, My Bookings, Account/Profile dropdown
  - Admin: Hidden unless user has admin role, shown in Account dropdown
- **Notes:** Login/Sign Up as primary CTA on far right for public view

### Component Library
- **Question:** Which Shadcn/UI components to use?
- **Decision:** Sheet (mobile menu), Button, Input, Avatar, DropdownMenu, Card, Calendar
- **Notes:** All components from Shadcn/UI standard set

### Design Tokens
- **Question:** How to map DESIGN.md tokens to Tailwind CSS?
- **Decision:** Purple (#800080) as primary, Teal (#2F4849) as secondary
- **Notes:** 8px spacing system, Montserrat + Cormorant fonts

---

## Canonical References Consulted

- DESIGN.md — Styling specifications
- .planning/REQUIREMENTS.md — UI/UX requirements
- .planning/ROADMAP.md — Phase 1 details

---

## Deferred Ideas

- Admin-only routes beyond Dashboard
- Recommendation engine UI placeholders
- Real-time data visualization beyond static charts
- Dark mode support

---

*Discussion completed: 2026-06-24*
