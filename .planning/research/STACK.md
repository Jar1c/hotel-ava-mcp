# Technology Stack

**Project:** Smart Hotel Reservation and Recommendation System
**Researched:** 2026-06-23
**Confidence:** HIGH (verified via Context7 docs and web sources)

---

## Stack Overview

```
┌─────────────────────────────────────────────────────┐
│                  FRONTEND (React)                    │
│  Vite 6 · React 19 · TypeScript · Tailwind CSS 4    │
│  React Router v7 · React Hook Form + Zod v4         │
│  TanStack Query v5 · Zustand v5                     │
│  react-day-picker v9 · Recharts v3                  │
│  Shadcn/UI · Lucide React · date-fns v4             │
├─────────────────────────────────────────────────────┤
│                  API LAYER                           │
│  Flask 3.x · Flask-CORS · supabase-py v2.31         │
│  Gunicorn · python-dotenv                           │
├─────────────────────────────────────────────────────┤
│              RECOMMENDATION & ANALYTICS              │
│  scikit-learn v1.7 · Surprise v1.1.5                │
│  pandas · numpy · scipy · statsmodels               │
├─────────────────────────────────────────────────────┤
│                  DATABASE                            │
│  Supabase (PostgreSQL) · Row Level Security         │
├─────────────────────────────────────────────────────┤
│              DEPLOYMENT & CI/CD                      │
│  Frontend: Vercel · Backend: Railway/Render          │
│  GitHub Actions · Playwright v1.61                   │
└─────────────────────────────────────────────────────┘
```

---

## Recommended Stack

### Frontend (React + Tailwind — Already Chosen)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Vite** | ^6.x | Build tool & dev server | CRA is deprecated. Vite is the standard React build tool in 2026. Sub-second HMR, native ESM, TypeScript out of the box. v6 is the current major. |
| **React** | ^19.x | UI framework | Latest stable. Concurrent features, improved server components. Industry standard. |
| **TypeScript** | ^5.7 | Type safety | Non-negotiable for production React apps. Catches errors at compile time. |
| **Tailwind CSS** | ^4.x | Styling | Already chosen. v4 uses Vite plugin, CSS-first configuration, improved performance. |
| **React Router** | ^7.x | Client-side routing | Industry standard for React SPA routing. v7 supports type-safe routes, loaders, and actions. Avoid React Router v6 — v7 is current. |
| **React Hook Form** | ^7.77 | Form management | Best-in-class for complex booking forms. Uncontrolled inputs minimize re-renders. Integrates directly with Zod via `@hookform/resolvers`. |
| **Zod** | ^4.x | Schema validation | TypeScript-first validation. v4 is current as of 2026 — 10x faster compilation than v3, smaller bundle with Zod Mini variant. Validates booking form data, API responses, and environment variables. |
| **TanStack Query** | ^5.x | Data fetching & caching | Eliminates manual loading/error state management. Automatic cache invalidation, background refetching, pagination. Essential for booking searches and room availability lookups. |
| **Zustand** | ^5.x | State management | ~1KB, zero boilerplate, hook-based. Keep booking state, filters, and UI state outside component tree. No Provider wrapper needed. Avoid Redux — overkill for this scope. |
| **react-day-picker** | ^9.x | Date picker calendar | Powers Shadcn/UI's calendar component. Tailwind-friendly classNames prop. Supports range selection, disabled dates, custom modifiers for booked days. 6M+ weekly downloads. Avoid react-datepicker — harder to style with Tailwind, larger bundle. |
| **Recharts** | ^3.x | Data visualization | Declarative React chart components (LineChart, BarChart, ComposedChart, PieChart). Built on D3 but no D3 knowledge needed. v3 adds accessibility layer and improved responsive containers. Perfect for admin analytics: occupancy rates, revenue trends, booking patterns. |
| **Shadcn/UI** | latest | UI component library | Copy-paste components built on Radix UI primitives with Tailwind styling. Calendar, Dialog, Popover, Select, Command palette. Gives us production-grade, accessible components without a heavy dependency. |
| **Lucide React** | latest | Icons | Clean, consistent SVG icon set. Lighter than Heroicons, more comprehensive. |
| **date-fns** | ^4.x | Date utilities | Tree-shakeable date manipulation. Used by react-day-picker internally. Functions like `format`, `differenceInDays`, `addDays` used extensively in booking logic. |
| **clsx** + **tailwind-merge** | latest | Class utilities | `clsx` for conditional classes, `tailwind-merge` to avoid Tailwind class conflicts. Standard Shadcn/UI companion. |

### Backend (Flask + Python — Already Chosen)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Flask** | ^3.1.x | Web framework | Already chosen. Lightweight, Pythonic, excellent extension ecosystem. v3.1 is current stable. |
| **supabase-py** | ^2.31 | Supabase client | Official Python client for Supabase. Handles auth, database queries, realtime subscriptions, and storage. Direct replacement for SQLAlchemy when using Supabase. |
| **Flask-CORS** | ^5.x | Cross-Origin Resource Sharing | Mandatory for development (React on :5173, Flask on :5000). Simple setup: `CORS(app)`. |
| **python-dotenv** | ^1.x | Environment variables | Load `.env` files for Supabase credentials, secret keys, API URLs. |
| **Gunicorn** | ^23.x | Production WSGI server | Multi-worker Python server. Required for production deployment. Do NOT use Flask's dev server in production. |
| **pydantic** | ^2.x | Request/response validation | Pydantic v2 is 5-50x faster than v1. Validates API request payloads, generates OpenAPI schemas. Consider as alternative to Marshmallow for stricter typing. |
| **marshmallow** | ^3.x | Serialization/deserialization | Flask-native serialization. Lighter than Pydantic if you prefer Flask's ecosystem. Both work; pick one. |

### Recommendation Engine (Python)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **scikit-learn** | ^1.7 | ML algorithms | The standard for content-based filtering. Use `cosine_similarity` for hotel attribute matching, `TfidfVectorizer` for review/text-based recommendations. v1.7 is latest stable. |
| **Surprise** | ^1.1.5 | Collaborative filtering | Purpose-built recommender systems library. SVD, SVD++, NMF, KNN algorithms. GridSearchCV for hyperparameter tuning. **Caveat:** Maintenance mode since 2019 (bugfixes only). Use for prototyping; production may need custom implementation or implicit library. |
| **implicit** | ^0.7.x | Implicit feedback ALS | For booking data (implicit signals: booked/not booked, viewed/not viewed). Alternating Least Squares for collaborative filtering on implicit feedback. Active and well-maintained. |
| **pandas** | ^2.x | Data manipulation | Required for feature engineering, data transformation, and preparing training datasets from Supabase query results. |
| **numpy** | ^1.x | Numerical computing | Foundation for all ML operations. Matrix operations for similarity computations. |
| **scipy** | ^1.x | Sparse matrices | Sparse matrix operations for large hotel datasets. Used by scikit-learn internally. |
| **nltk** / **spacy** | latest | NLP (hotel reviews) | If using review text for content-based recommendations. spaCy is faster, nltk is more educational. Use spaCy for production. |

### Predictive Analytics (Python)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **statsmodels** | ^0.14.x | Time series forecasting | ARIMA/SARIMA models for revenue and occupancy forecasting. `seasonal_decompose` for identifying booking patterns. Production-proven statistical modeling. |
| **Prophet** | ^1.x | Forecasting | Meta's forecasting tool. Handles holiday effects, seasonality, changepoints automatically. Good fallback if statsmodels ARIMA tuning is too complex. Optional — install only if needed. |
| **scikit-learn** | ^1.7 | Regression models | LinearRegression, RandomForestRegressor for price optimization and demand prediction. |
| **pandas** | ^2.x | Time series data | Resampling, rolling windows, date-based aggregations for booking trends. |

### Database (Supabase — Already Chosen)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Supabase** | latest | Database + Auth + Storage | Already chosen. PostgreSQL with Row Level Security, built-in auth, realtime subscriptions, file storage. Supabase-py client handles all interactions. |
| **supabase-py** | ^2.31 | Python client | Direct CRUD from Flask. Auth, query builder, storage API. |

---

## Testing

| Layer | Tool | Version | Purpose | Why |
|-------|------|---------|---------|-----|
| **React unit/integration** | Vitest | ^4.x | Test runner | Vite-native, Jest-compatible API. v4 is current. Runs in-browser for component testing via `vitest-browser-react`. 5-20x faster than Jest for Vite projects. |
| **React component testing** | React Testing Library | ^16.x | Component tests | Test components as users interact with them. Pairs with Vitest. Avoid Enzyme (deprecated). |
| **React E2E** | Playwright | ^1.61 | End-to-end | Tests booking flows, search, admin dashboard across Chromium/Firefox/WebKit. Auto-wait, trace viewer for debugging. v1.61 is latest. |
| **Flask unit/integration** | pytest | ^8.x | Test runner | Python standard. `pytest-flask` plugin provides Flask test fixtures. |
| **Flask coverage** | pytest-cov | ^5.x | Coverage reporting | Generates coverage reports. Gate on 80%+ coverage. |
| **API testing** | Playwright (API testing) | ^1.61 | Backend API tests | Playwright's API testing capabilities can test Flask endpoints without a browser. Single tool for both E2E and API tests. |

### Testing Strategy

```
┌───────────────────────────────────────────────────┐
│                   E2E (Playwright)                 │
│   Critical booking flows · Search → Select → Book │
│   Admin dashboard rendering · Auth flow           │
├───────────────────────────────────────────────────┤
│            Integration (Vitest + pytest)           │
│   Component interactions · API endpoint tests     │
│   Form validation · Data fetching logic           │
├───────────────────────────────────────────────────┤
│            Unit (Vitest + pytest)                  │
│   Utility functions · Hooks · Helpers             │
│   ML model tests · Data pipeline tests            │
└───────────────────────────────────────────────────┘
```

---

## Infrastructure & Deployment

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Vercel** | — | Frontend hosting | Best-in-class for React/Vite deployment. Automatic HTTPS, CDN, preview deployments per branch. Zero-config for Vite projects. Free tier generous. |
| **Railway** | — | Backend hosting | Excellent Flask support. Nixpacks auto-detect Python/Flask. Built-in PostgreSQL (or connect to Supabase). Graph view of services. Usage-based pricing (no sleeping on paid). |
| **Render** | — | Backend hosting (alt) | Set-it-forget-it Heroku replacement. Flask buildpack. Predictable flat pricing. Free tier sleeps after inactivity (cold start). |
| **GitHub Actions** | — | CI/CD | Standard for both frontend and backend. Run tests on PR, deploy to Vercel/Railway on merge. Parallel job support. |
| **Docker** | — | Containerization | Optional. Railway supports Dockerfiles if needed. Not required for MVP but useful for reproducible environments. |

### Deployment Architecture

```
                     ┌──────────────┐
                     │  Cloudflare   │
                     │  (DNS/CDN)    │
                     └──────┬───────┘
                            │
                    ┌───────┴───────┐
                    │               │
            ┌───────▼───┐   ┌───────▼───┐
            │  Vercel   │   │  Railway  │
            │  (React)  │   │  (Flask)  │
            └───────┬───┘   └───────┬───┘
                    │               │
                    │       ┌───────▼───┐
                    │       │ Supabase  │
                    │       │ (Postgres)│
                    │       └───────────┘
                    │
            ┌───────┴───────┐
            │  GitHub       │
            │  Actions CI   │
            └───────────────┘
```

**Recommendation:** Vercel for frontend + Railway for backend. Both have free tiers. Railway's Nixpacks auto-detect Flask projects and handle installation/build automatically. Vercel's GitHub integration deploys on every push.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| **Build tool** | Vite 6 | Create React App | CRA is deprecated since 2023. No longer maintained. |
| **State management** | Zustand 5 | Redux Toolkit | Redux is 13KB+ and requires boilerplate (slices, reducers, actions). Zustand is ~1KB, hook-based, no boilerplate. For a hotel app with moderate state complexity, Zustand is the right fit. |
| **Data fetching** | TanStack Query 5 | SWR | TanStack Query has richer devtools, better mutation handling, and more active community. SWR is lighter but less feature-complete for booking operations (optimistic updates, pagination). |
| **Date picker** | react-day-picker 9 | react-datepicker | react-datepicker bundles its own CSS, harder to style with Tailwind. react-day-picker is headless, Tailwind-friendly, and powers Shadcn/UI's calendar component. |
| **Charts** | Recharts 3 | Chart.js/react-chartjs-2 | Recharts is declarative React components. Chart.js is imperative canvas-based. Recharts aligns with React's component model and handles responsive containers better. |
| **Form validation** | React Hook Form + Zod 4 | Formik + Yup | React Hook Form is more performant (uncontrolled inputs). Zod v4 is 10x faster compilation than Yup, has better TypeScript inference. |
| **CSS framework** | Tailwind CSS 4 | SCSS modules | Already chosen. v4's Vite plugin and CSS-first config are significant DX improvements. |
| **Flask testing** | pytest + pytest-flask | unittest | pytest is the Python standard. pytest-flask provides convenient fixtures (`client`, `app`). unittest is more verbose and less flexible. |
| **Backend deployment** | Railway | Render | Railway has better DX (Nixpacks auto-detect, no Dockerfile needed), no cold starts on paid tier, built-in databases. Render's free tier sleeps after inactivity. |
| **E2E testing** | Playwright | Cypress | Playwright is faster, supports more browsers (including WebKit), has built-in API testing, trace viewer for debugging. Cypress has a friendlier GUI but is Chromium-only and slower. |
| **Recommendation framework** | scikit-learn + Surprise + implicit | TensorFlow / PyTorch | You don't need deep learning for hotel recommendations. Matrix factorization (SVD) and content-based similarity are well-established and far simpler to deploy. DL is overkill for this domain. |
| **Forecasting** | statsmodels + Prophet | TensorFlow / PyTorch | Revenue forecasting is a classic time series problem. ARIMA/SARIMA models are interpretable and don't need GPU training. Prophet handles seasonality automatically. |

---

## Installation

### Frontend

```bash
# Create Vite + React + TypeScript project
npm create vite@latest hotel-frontend -- --template react-ts
cd hotel-frontend

# Core dependencies
npm install react-router-dom@7 @hookform/resolvers zod@4
npm install @tanstack/react-query zustand
npm install react-day-picker@9 date-fns@4
npm install recharts@3
npm install lucide-react clsx tailwind-merge

# Shadcn/UI (initialize)
npx shadcn@latest init
npx shadcn@latest add calendar popover dialog select command

# Development dependencies
npm install -D vitest@4 @testing-library/react @testing-library/jest-dom
npm install -D @playwright/test eslint prettier
```

### Backend

```bash
# Create virtual environment
python -m venv venv
source venv/Scripts/activate  # Windows
# or: source venv/bin/activate  # Linux/Mac

# Core dependencies
pip install flask==3.1.*
pip install supabase==2.31.*
pip install flask-cors==5.*
pip install python-dotenv==1.*
pip install gunicorn==23.*

# Recommendation dependencies
pip install scikit-learn==1.7.*
pip install scikit-surprise==1.1.*
pip install implicit==0.7.*
pip install pandas==2.* numpy==1.* scipy==1.*

# Predictive analytics dependencies
pip install statsmodels==0.14.*
pip install prophet==1.*  # optional

# Testing dependencies
pip install pytest==8.* pytest-flask==1.* pytest-cov==5.*
```

### CI/CD (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci && npm run build && npm test
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install -r requirements.txt && pytest --cov=app
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci && npx playwright install && npx playwright test
```

---

## Version / Compatibility Matrix

| Frontend Package | Min Node | Notes |
|-----------------|----------|-------|
| Vite 6 | 18+ | Requires Node 18+. Current Node LTS is 22. |
| React 19 | 18+ | Breaks with React 17. Ensure entire ecosystem is React 19 compatible. |
| Tailwind CSS 4 | 18+ | Uses Vite plugin; not PostCSS-based like v3. |
| React Router 7 | 18+ | Breaking changes from v6 (removed `Switch`, new loader API). |
| Shadcn/UI | 18+ | Requires Tailwind v3.4+ or v4. |

| Backend Package | Min Python | Notes |
|-----------------|------------|-------|
| Flask 3.1 | 3.9+ | Flask 3.0+ drops Python 3.8 support. |
| supabase-py 2.31 | 3.9+ | Async support requires Python 3.10+. |
| scikit-learn 1.7 | 3.9+ | Drops Python 3.8 as of 1.6. |
| Surprise 1.1.5 | 3.10+ | Requires Python >= 3.10 as of latest release. |
| statsmodels 0.14 | 3.9+ | |

---

## Key Avoidances

| Technology | Reason to Avoid |
|------------|-----------------|
| **Redux Toolkit** | Overkill for hotel app state. Zustand is 13x smaller, simpler, and sufficient. |
| **Formik + Yup** | Outperformed by React Hook Form + Zod in both runtime performance and TypeScript DX. |
| **Create React App** | Deprecated. No longer maintained. Use Vite. |
| **Marshmallow (for new projects)** | Pydantic v2 is faster and provides better TypeScript-like type validation. |
| **Node.js backend** | Flask is already chosen and well-suited. No need for Node.js API layer. |
| **TensorFlow / PyTorch** | Overkill. Matrix factorization (SVD) + content-based similarity is standard for hotel recommendations. |
| **Heroku** | Expensive for what you get. Render and Railway offer better value. |
| **Cypress** | Slower than Playwright, Chromium-only, no API testing built in. |

---

## Sources

- [Context7: react-day-picker v9 docs](https://react-day-picker.js.org)
- [Context7: Recharts v3 docs](https://recharts.org)
- [Context7: React Hook Form v7 docs](https://react-hook-form.com)
- [Context7: TanStack Query v5 docs](https://tanstack.com/query/latest)
- [Context7: Vitest v4 docs](https://vitest.dev)
- [Context7: Playwright v1.61 docs](https://playwright.dev)
- [Context7: Zod v4 docs](https://zod.dev)
- [Context7: Zustand v5 docs](https://zustand.pmnd.rs)
- [Context7: Flask 3.x docs](https://flask.palletsprojects.com)
- [Context7: scikit-learn 1.7 docs](https://scikit-learn.org)
- [Supabase Python docs](https://supabase.com/docs/reference/python/introduction)
- [Surprise recommender library](https://surpriselib.com)
- [Railway Flask deploy guide](https://docs.railway.com/guides/flask)
- [Render Flask deploy guide](https://render.com/docs/deploy-flask)
- [Vercel React deploy guide](https://vercel.com/docs/frameworks/react)
- [Builder.io: Best React calendar components 2025-2026](https://www.builder.io/blog/best-react-calendar-component-ai)
- [BSWEN: React date picker comparison 2026](https://docs.bswen.com/blog/2026-03-22-react-datepicker-library-comparison/)
- [DevPro Portal: Python web deployment comparison 2025](https://devproportal.com/languages/python/python-web-deployment-comparison-heroku-vercel-render-railway-2025/)
