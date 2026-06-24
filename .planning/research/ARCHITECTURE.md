# Architecture Patterns

**Domain:** Hotel Reservation and Recommendation System
**Researched:** 2026-06-23

---

## Recommended Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           REACT CLIENT (Vite)                            │
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐  │
│  │  Pages   │  │Comps.    │  │  Hooks   │  │  State (Zustand)       │  │
│  │          │  │(Shadcn)  │  │(useAuth) │  │  bookingStore          │  │
│  │ Search   │  │ Calendar │  │(useBook) │  │  filterStore           │  │
│  │ RoomDetail│  │ RoomCard │  │(useRooms)│  │  uiStore              │  │
│  │ Dashboard│  │ Chart    │  │(useRec)  │  └────────────────────────┘  │
│  │ Admin    │  │ Form     │  │          │                               │
│  └──────────┘  └──────────┘  └────┬─────┘                               │
│                                    │                                     │
│                           ┌────────▼────────┐                           │
│                           │  TanStack Query  │                           │
│                           │  (Data Fetching) │                           │
│                           │  Cache · Mutate  │                           │
│                           └────────┬────────┘                           │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │  HTTP/JSON
                                     │  (Flask API)
┌────────────────────────────────────┼────────────────────────────────────┐
│                           FLASK API (Gunicorn)                          │
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌───────┴────────┐  ┌──────────────────┐  │
│  │  Routes  │  │  Auth    │  │  Services      │  │  ML Engine       │  │
│  │          │  │ (JWT)    │  │                │  │                  │  │
│  │ /api/    │  │ supabase │  │  room_service  │  │  recommender.py  │  │
│  │  rooms   │  │ .auth    │  │  booking_svc   │  │  forecast.py     │  │
│  │ /api/    │  │          │  │  analytics_svc │  │  similarity.py   │  │
│  │  bookings│  │          │  │  user_svc      │  │                  │  │
│  │ /api/    │  │          │  │                │  └──────────────────┘  │
│  │  rec     │  │          │  └────────┬───────┘                        │
│  └──────────┘  └──────────┘           │                                │
└───────────────────────────────────────┼────────────────────────────────┘
                                        │
                               ┌────────▼────────┐
                               │    Supabase      │
                               │  (PostgreSQL)    │
                               │                  │
                               │  rooms           │
                               │  bookings        │
                               │  users           │
                               │  reviews         │
                               │  RLS policies    │
                               └──────────────────┘
```

### Data Flow — Booking Search

```
User selects dates + guests
  → Zustand filterStore updates
  → TanStack Query fetches GET /api/rooms?check_in=...&check_out=...&guests=...
  → Flask route validates params (Zod schema equivalent on backend)
  → Service queries Supabase: available rooms for date range
  → Returns JSON → TanStack Query caches result
  → React re-renders room grid with new data
```

### Data Flow — Recommendation

```
Guest views room detail page
  → GET /api/rooms/{id} returns room data
  → GET /api/recommendations/{room_id}?user_id=... (if logged in)
  → Flask recommender service:
      1. Content-based: cosine similarity on room attributes vs all other rooms → top 5
      2. Collaborative (if user history): SVD-based prediction for this user → top 5
      3. Hybrid: weighted combination (configurable, e.g., 60% CB + 40% CF)
  → Returns [{room_id, score, reason}, ...]
  → UI displays "You might also like" section
```

### Data Flow — Admin Analytics

```
Admin loads dashboard
  → TanStack Query fetches GET /api/analytics/revenue?period=month
  → Flask analytics service:
      1. Queries Supabase: aggregate bookings by date
      2. Runs statsmodels ARIMA model on historical data (if enough data)
      3. Returns {actual: [...], forecast: [...], confidence: [...]}
  → Recharts renders combined actual + forecast chart
  → Admin sees real data + predictions
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Pages** | Route-level components. Orchestrates data fetching and layout. | Hooks, Layout components |
| **UI Components (Shadcn)** | Reusable presentational components: Calendar, Button, Dialog, Select, Popover | Parent components via props |
| **RoomCard** | Displays room summary: image, price, rating, amenities, availability indicator | TanStack Query for data |
| **DateRangePicker** | Check-in/check-out selection. Prevents invalid ranges (past dates, overlapping bookings) | Zustand filterStore |
| **GuestSelector** | Adults/children count stepper | Zustand filterStore |
| **BookingForm** | Multi-step or single-page form: guest details, special requests, confirm | React Hook Form + Zod |
| **Charts (Recharts)** | Admin analytics: revenue trend, occupancy rate, booking patterns | TanStack Query for data |
| **Zustand Stores** | Client-side state: booking filters, UI state, auth state | Hooks subscribe to stores |
| **TanStack Query** | Server state: caching, background refetch, optimistic updates | Flask API endpoints |
| **Flask Routes** | API endpoints. Validates input, calls services, returns JSON | Service layer |
| **Services** | Business logic: booking validation, availability checks, recommendation computation | Supabase client, ML Engine |
| **ML Engine** | Recommendation and forecasting models. Standalone Python modules, not Flask-coupled | pandas, scikit-learn, statsmodels |
| **Supabase Client** | Database queries, auth management, realtime subscriptions | Supabase backend |
| **Supabase (Database)** | Data persistence: rooms, bookings, users, reviews. Row-Level Security for auth | RLS policies enforce permissions |

---

## Patterns to Follow

### Pattern 1: Repository Pattern for Database Access
**What:** Encapsulate all Supabase queries in service modules. Routes never call `supabase.table(...)` directly.
**When:** Always — keeps database access testable and replaceable.
**Example:**
```python
# app/services/room_service.py
from supabase import Client

class RoomService:
    def __init__(self, supabase: Client):
        self._db = supabase

    def get_available_rooms(self, check_in: str, check_out: str, guests: int):
        return self._db.rpc('get_available_rooms', {
            'p_check_in': check_in,
            'p_check_out': check_out,
            'p_guests': guests
        }).execute().data

    def get_room_by_id(self, room_id: str):
        return self._db.table('rooms').select('*').eq('id', room_id).single().execute().data
```

### Pattern 2: Optimistic Updates for Bookings
**What:** When a user books a room, immediately update the UI to show the room as booked, then send the API request. Revert on failure.
**When:** Essential for booking UX — users expect instant feedback.
**Example:**
```typescript
// hooks/useBooking.ts
const mutation = useMutation({
  mutationFn: (bookingData: BookingInput) => api.createBooking(bookingData),
  onMutate: async (newBooking) => {
    await queryClient.cancelQueries({ queryKey: ['rooms'] });
    const previous = queryClient.getQueryData(['rooms']);
    queryClient.setQueryData(['rooms'], (old) => optimisticBook(old, newBooking));
    return { previous };
  },
  onError: (err, newBooking, context) => {
    queryClient.setQueryData(['rooms'], context?.previous);
    toast.error('Booking failed. Please try again.');
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
});
```

### Pattern 3: Hybrid Recommendation Adapter
**What:** A single recommendation interface that delegates to content-based, collaborative filtering, or a weighted combination based on available data.
**When:** The recommendation system needs multiple strategies with configurable weighting.
**Example:**
```python
# app/recommender/hybrid.py
from .content_based import ContentBasedRecommender
from .collaborative import CollaborativeRecommender

class HybridRecommender:
    def __init__(self, cb_weight: float = 0.6, cf_weight: float = 0.4):
        self.cb = ContentBasedRecommender()
        self.cf = CollaborativeRecommender()
        self.cb_weight = cb_weight
        self.cf_weight = cf_weight

    def recommend(self, user_id: str, room_id: str, n: int = 5):
        cb_results = self.cb.recommend(room_id, n * 2)
        cf_results = self.cf.recommend(user_id, n * 2) if user_id else []

        # Weight and merge
        scored = {}
        for room, score in cb_results:
            scored[room] = score * self.cb_weight
        for room, score in cf_results:
            scored[room] = scored.get(room, 0) + score * self.cf_weight

        ranked = sorted(scored.items(), key=lambda x: -x[1])
        return ranked[:n]
```

### Pattern 4: Flask Service Layer with Dependency Injection
**What:** Inject Supabase client and other dependencies into service constructors. Makes unit testing possible without hitting the database.
**When:** All Flask services. Essential for testability.
**Example:**
```python
# app/__init__.py
from supabase import create_client
from .services.room_service import RoomService
from .services.booking_service import BookingService

def create_app():
    app = Flask(__name__)
    supabase = create_client(
        os.environ['SUPABASE_URL'],
        os.environ['SUPABASE_SERVICE_KEY']
    )

    # Dependency injection
    app.room_service = RoomService(supabase)
    app.booking_service = BookingService(supabase)

    from .routes import register_routes
    register_routes(app)
    return app
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: God Route Handler
**What:** Putting business logic directly in Flask route functions.
**Why bad:** Untestable. Routes become bloated. Violates SRP.
**Instead:** Routes call services. Services contain logic.

### Anti-Pattern 2: Direct Supabase Calls from React
**What:** Using `@supabase/supabase-js` directly in React components, bypassing Flask.
**Why bad:** Exposes Supabase service key to clients. Circumvents backend validation. No logging.
**Instead:** All database access goes through Flask API. React talks only to Flask endpoints.

### Anti-Pattern 3: Monolithic ML Module
**What:** All recommendation logic in one file.
**Why bad:** Mixes content-based, collaborative, and utility code. Hard to test, hard to swap algorithms.
**Instead:** Separate modules per algorithm type. Adapter pattern for hybrid composition.

### Anti-Pattern 4: Training Models in API Request Handlers
**What:** Fitting scikit-learn models on every recommendation request.
**Why bad:** BLOCKING. Model training is CPU-intensive. A single training request blocks all other requests (Flask's sync workers).
**Instead:** Pre-train models in background jobs (Celery, Redis Queue, or cron-triggered scripts). Cache model files. API only loads and predicts.

---

## Scalability Considerations

| Concern | At 100 users (MVP) | At 10K users (Growth) | At 1M users (Scale) |
|---------|-------------------|----------------------|---------------------|
| **Flask workers** | 1 Gunicorn worker | 4-8 Gunicorn workers + async | Migrate to FastAPI or add Celery workers |
| **Supabase connections** | Shared plan (5-25 connections) | Connection pooling (Supabase Pro) | Read replicas + connection pooling |
| **Recommendation computation** | In-process, single-threaded | Background Celery task, cache results | Pre-computed embeddings in vector DB (pgvector) |
| **Analytics queries** | Direct Supabase queries | Materialized views on Supabase | Dedicated analytics database (ClickHouse) |
| **Static assets** | Vite dev server | Vercel CDN | Vercel CDN (same — good at scale) |
| **Session storage** | Flask session cookie | Supabase JWT + Redis cache | Distributed Redis cluster |
| **Search** | SQL LIKE on Supabase | Full-text search (Postgres tsvector) | Dedicated search (Meilisearch / Algolia) |

---

## Sources

- [Supabase Python client architecture](https://supabase.com/docs/reference/python/introduction)
- [Flask application patterns](https://flask.palletsprojects.com/en/stable/patterns/appfactories/)
- [TanStack Query optimistic updates](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates)
- [Surprise recommender system design](https://surprise.readthedocs.io/en/stable/getting_started.html)
- [Hotel-Recommender deployment pattern (Flask + content-based)](https://github.com/alantancr/Hotel-Recommender)
- [Business intelligence system Flask architecture](https://github.com/JavadTorabiKh/Business-intelligence-system)
- [Analytics dashboard Flask + React architecture](https://github.com/ryansansbury/analytics_dashboard)
