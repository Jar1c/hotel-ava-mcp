<!-- GSD:project-start source:PROJECT.md -->
## Project

# Smart Hotel Reservation and Recommendation System

**Core Value:** Provide personalized room recommendations and predictive insights that increase bookings while optimizing hotel operations through data-driven decision making.

This is a hotel booking platform with AI-driven recommendations for guests and predictive analytics for management. Built with React + Tailwind CSS frontend, Flask + Python backend, and Supabase database. Frontend-first development strategy.

Current Phase: Phase 1 - UI/UX Foundation
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

**Frontend:**
- React 19 + TypeScript via Vite 6
- Tailwind CSS 4 + Shadcn/UI for components
- React Hook Form + Zod 4 for form validation
- TanStack Query 5 for data fetching
- Zustand 5 for state management
- react-day-picker 9 for date selection
- Recharts 3 for analytics charts

**Backend:**
- Flask 3.1
- Supabase-py 2.31 for database access
- scikit-learn 1.7 for recommendations (future phases)
- statsmodels 0.14 for predictive analytics (future phases)

**Deployment:**
- Vercel for frontend hosting
- Railway or Render for backend hosting

**Testing:**
- Playwright 1.61 for end-to-end tests
<!-- GSD:stack-end -->

<!-- GSD:architecture-start source:research/ARCHITECTURE.md -->
## Architecture

Frontend-first architecture with progressive backend integration.

**Frontend Structure (Phase 1-4):**
- Pages: Landing, Rooms List, Room Detail, Login/Register, Admin Dashboard
- Components: Header, Footer, RoomCard, DatePicker, Charts
- All API calls route through Flask backend (never direct Supabase from React)

**Backend Structure (Phase 5):**
- Flask API endpoints for auth, rooms, bookings, admin
- Supabase client via supabase-py
- Repository pattern for data access

**Recommendation Engine (future phases):**
- Popularity baseline for cold-start users
- Content-based filtering via scikit-learn
- Collaborative filtering via implicit library (NOT Surprise - in maintenance mode)
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- /gsd-quick for small fixes, doc updates, and ad-hoc tasks
- /gsd-debug for investigation and bug fixing
- /gsd-execute-phase for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run /gsd-profile-user to generate your developer profile.
> This section is managed by generate-claude-profile � do not edit manually.
<!-- GSD:profile-end -->

## Feature Requirements

### Homepage Search/Recommender Bar
- Input fields: check-in date, check-out date, number of guests, budget range (slider)
- On submit, filter and rank available rooms by guest capacity + budget match
- Display results on /rooms page, sorted by best match first

### Landing Page Sections Needed (currently missing)
- Search/filter bar (below hero)
- Amenities / "Why Hotel Ava" section
- Guest reviews/testimonials
- Location/map section
- Footer (contact, social links, copyright)