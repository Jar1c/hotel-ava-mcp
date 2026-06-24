# Domain Pitfalls

**Domain:** Hotel Reservation and Recommendation System
**Researched:** 2026-06-23

---

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Building the Recommendation Engine Before Data Exists
**What goes wrong:** You spend weeks building a collaborative filtering model, then launch to find you have 50 bookings and the model returns random results. Cold-start problem kills the feature.
**Why it happens:** ML teams build what's technically interesting, not what's validated. "We need recommendations!" sounds urgent but isn't actionable without data.
**Consequences:** Wasted engineering time. Demoralized team. Product launches with broken features.
**Prevention:** Phase 4+ only, after Phase 3 has generated real booking data. Start with simple content-based recommendations (room attribute similarity) — no user history needed. Use popularity as the baseline. Only add collaborative filtering when you have 1000+ bookings.
**Detection:** If you're planning the recommendation engine before the database schema, you're doing it wrong.

### Pitfall 2: Exposing Supabase Service Key to the Frontend
**What goes wrong:** You use `@supabase/supabase-js` directly from React to keep things "simple." The service key (which bypasses Row Level Security) is now in the browser. Anyone can inspect the network tab and steal it.
**Why it happens:** Supabase's quickstart examples (the `supabase-js` library) encourage direct client usage. Developers follow this pattern without understanding that they need the anon key + RLS, not the service key.
**Consequences:** Complete database access. Users can read/write any table. Data breach.
**Prevention:** React never talks to Supabase directly. All database access goes through Flask API. React uses only Flask endpoints. Supabase service key stays server-side only.
**Detection:** Search the frontend codebase for `SUPABASE_SERVICE_KEY`, `supabase.service_role` or direct `supabase.table()` calls in React.

### Pitfall 3: Treating Surprise as a Production Library
**What goes wrong:** You build the entire recommendation system around Surprise, then discover it's in maintenance mode (last feature update: Sept 2019). A bug in production has no fix timeline. Alternatively, Surprise only handles explicit ratings (1-5 stars), but hotel booking is implicit (booked/not-booked).
**Why it happens:** Surprise is the most well-known Python recommender library. Its README and PyPI page don't prominently warn about maintenance mode.
**Consequences:** You need to rewrite the recommendation module when Surprise can't handle implicit data or has an unfixed bug.
**Prevention:** Use Surprise for prototyping and algorithm selection in Phase 4 research. For production, use the `implicit` library (ALS for implicit feedback) or custom scikit-learn implementations. The `implicit` library handles "booked/not-booked" data naturally.
**Detection:** If your business logic passes rating values (1-5) when you only have booking data (true/false), you're using the wrong tool.

### Pitfall 4: Flask Dev Server in Production
**What goes wrong:** You deploy with `flask run` (or `python app.py`) instead of Gunicorn. The single-threaded Werkzeug dev server handles one request at a time. Under any real load, the app becomes unresponsive. A single slow request blocks all others.
**Why it happens:** Flask docs clearly warn against this, but it's the default development pattern. Easy to overlook in deployment scripts.
**Consequences:** Complete application unavailability under any concurrent traffic. Timeouts on booking requests.
**Prevention:** Use Gunicorn as the production server. Railway and Render both support Gunicorn natively. Include it in `requirements.txt` and set the start command to `gunicorn -w 4 app:app`.
**Detection:** Check `requirements.txt` for `gunicorn`. Check `Procfile` or deployment start command.

### Pitfall 5: Double-Booked Rooms (Race Conditions)
**What goes wrong:** Two users view the same available room. Both click "Book Now" simultaneously. Both requests pass the availability check. Both bookings succeed. Room is double-booked.
**Why it happens:** Checking availability and creating a booking are separate database operations. Without a transaction or lock, concurrent requests create a race condition.
**Consequences:** Angry guests. Operational nightmare. Refund costs. Reputation damage.
**Prevention:** Use PostgreSQL row-level locking (`SELECT ... FOR UPDATE`) within a transaction. Or use Supabase RPC functions that atomically check and book. Never check availability and create a booking in separate non-transactional queries.
**Detection:** Load test the booking endpoint with concurrent requests. Check if any double-bookings occur.

---

## Moderate Pitfalls

### Pitfall 1: Infinite Calendar Scroll / No End Date Constraint
**What goes wrong:** Date range picker allows selecting check-in and check-out on the same day, or check-out before check-in, or a 30-day stay when the hotel only allows 14 days. Users book invalid stays, then customer support deals with it.
**Prevention:** Set `minDate`, `maxDate`, and `disabled` props on react-day-picker. Add Zod validation in the booking form schema:
```typescript
const bookingSchema = z.object({
  checkIn: z.date(),
  checkOut: z.date(),
}).refine(data => data.checkOut > data.checkIn, {
  message: "Check-out must be after check-in",
}).refine(data => {
  const nights = differenceInDays(data.checkOut, data.checkIn);
  return nights >= 1 && nights <= 14;
}, { message: "Stay must be 1-14 nights" });
```

### Pitfall 2: No Loading / Error States for Analytics Charts
**What goes wrong:** Admin dashboard shows charts on load. When the Flask API is slow (training an ML model) or Supabase is down, the page shows blank white boxes. Admins think the system is broken.
**Prevention:** Every chart component must handle loading (skeleton/spinner), error (retry + message), and empty (no data yet) states, not just success. Wrap all Recharts components with TanStack Query's `isLoading`, `isError`, `isSuccess` states.

```typescript
function RevenueChart() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['revenue'], queryFn: fetchRevenue });
  if (isLoading) return <Skeleton className="h-[400px]" />;
  if (isError) return <ErrorCard message="Failed to load revenue data" onRetry={refetch} />;
  if (!data?.length) return <EmptyState message="No booking data yet" />;
  return <ResponsiveContainer><LineChart data={data}>...</LineChart></ResponsiveContainer>;
}
```

### Pitfall 3: Slow Supabase Queries Without Indexes
**What goes wrong:** Room search queries (`WHERE check_in >= ? AND check_out <= ? AND guests <= ?`) are slow on even moderate datasets (10K+ rooms). Page load times hit 3-5 seconds.
**Prevention:** Create composite indexes on the bookings table for the most common query patterns:
```sql
CREATE INDEX idx_bookings_dates ON bookings(room_id, check_in, check_out);
CREATE INDEX idx_rooms_capacity ON rooms(max_guests);
CREATE INDEX idx_rooms_active ON rooms(is_active) WHERE is_active = true;
```
Also use Supabase's built-in query analyzer to identify slow queries.

### Pitfall 4: JWT Token Not Refreshed After Expiry
**What goes wrong:** User logs in, gets a 1-hour JWT token. They browse for 30 minutes, then try to book. The token expired, the booking API returns 401. User sees "Not authorized" error instead of "Session expired, please log in again."
**Prevention:** Implement token refresh logic in the Supabase auth flow. Supabase-py's `sync` client can automatically refresh tokens if configured with `flow_type="pkce"`. On the frontend, intercept 401 responses and attempt token refresh before showing error.

### Pitfall 5: Ignoring Popularity Baseline for Recommendations
**What goes wrong:** You spend weeks building a complex collaborative filtering model, then benchmark it against "recommend the most popular hotels to everyone" and discover your model is WORSE. This is a documented result — one hotel recommender study found SVD performed worse than popularity baseline.
**Prevention:** Always implement the popularity baseline first (it's one Supabase query: `SELECT room_id, COUNT(*) as bookings FROM bookings GROUP BY room_id ORDER BY bookings DESC`). Measure your recommender against it. If your model doesn't beat popularity, simplify your approach.

---

## Minor Pitfalls

### Pitfall 1: Hardcoded Currency / Locale
**What goes wrong:** Prices display as `$150` but the hotel is in Tokyo. Or `€150` for a US-based hotel. Users are confused about the actual cost.
**Prevention:** Store prices in a base currency (USD) in the database. Use a formatter utility that accepts a locale parameter:
```typescript
export function formatPrice(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}
```

### Pitfall 2: Not Handling Daylight Saving Time in Date Calculations
**What goes wrong:** A booking for March 12, 2026 is calculated as 3 nights but the UI shows 2 nights because of DST transition (23-hour day).
**Prevention:** Use date-fns's `differenceInCalendarDays` (calendar-aware) instead of `differenceInDays` (time-aware) for booking nights calculation. Store all dates as UTC in Supabase.

### Pitfall 3: Admin Table Without Pagination
**What goes wrong:** Admin booking list page loads ALL bookings at once. With 50 bookings it's fine. With 5,000, the page takes 10 seconds to load and crashes the browser.
**Prevention:** Implement pagination from the start — both on the Flask API (`LIMIT/OFFSET`) and in the React table. Shadcn/UI's table component supports pagination out of the box. TanStack Query handles page-based caching.

### Pitfall 4: Sharing Flask Session Across Gunicorn Workers
**What goes wrong:** Flask's default session storage is in-memory. Gunicorn spawns multiple worker processes. User authenticates with worker A, their next request hits worker B, and they're shown as logged out.
**Prevention:** Use Supabase JWT tokens (stored client-side, sent with every request) instead of Flask server-side sessions. Or configure Flask sessions to use a shared Redis backend.

### Pitfall 5: No Rate Limiting on Booking API
**What goes wrong:** A malicious user or buggy script sends 1000 booking requests per second. The Flask API saturates, Supabase connection pool exhausts, and real users get 503 errors.
**Prevention:** Add rate limiting via Flask-Limiter or at the reverse proxy level. Even a simple in-memory rate limiter (100 requests/minute per IP) prevents accidental or malicious abuse.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Phase 1: React Setup** | Using Create React App (deprecated) | Use Vite 6. Verify `npm create vite@latest`. |
| **Phase 1: Date Picker** | No min date (past dates selectable) | Always set `disabled={{ before: new Date() }}` on react-day-picker. |
| **Phase 1: Forms** | Booking form without Zod validation | Schema-validate on every form field. Don't trust browser validation alone. |
| **Phase 2: Charts** | Recharts without responsive wrapper | Always wrap charts in `<ResponsiveContainer>` — it's not optional. |
| **Phase 2: Charts** | Missing loading/error states on admin dashboard | Every chart component must handle loading, error, empty, AND success. |
| **Phase 3: Flask API** | Direct Supabase calls from React | Never import supabase-js on frontend. All DB access through Flask. |
| **Phase 3: Flask API** | Flask dev server in production | Use Gunicorn. Add to requirements.txt and start command. |
| **Phase 3: Database** | No indexes on bookings table | Create composite indexes before any real booking data. |
| **Phase 3: Auth** | JWT not refreshed | Implement token refresh interceptor from Phase 1. |
| **Phase 4: Recommender** | Surprise for implicit data | Use `implicit` library or scikit-learn for booking (binary) data. |
| **Phase 4: Recommender** | No popularity baseline | Implement popularity baseline BEFORE any ML model. Compare results. |
| **Phase 4: Recommender** | Training model in request handler | Pre-train in background job. Cache model file. Only predict in API. |
| **Phase 5: Analytics** | Prophet dependency issues | Prophet requires pystan (C++ compiler). Consider statsmodels as primary, Prophet as optional. |
| **Phase 6: Testing** | Python virtual env issues in CI | Pin Python version in CI matrix. Use `actions/setup-python@v5`. |
| **Phase 6: Deployment** | CORS issues between Vercel + Railway | Test CORS configuration early. Use Flask-CORS with explicit origins. |
| **Phase 7: Real-time** | WebSocket complexity | Use Supabase Realtime (PostgreSQL replication) instead of custom WebSockets. |

---

## Sources

- [Collaborative Filtering for Hotel Bookings — SVD vs Popularity](https://github.com/susanli2016/Machine-Learning-with-Python/blob/master/Collaborative%20Filtering%20RecSys%20with%20Implicit%20Data_Hotel%20booking.ipynb) — Research notebook showing SVD performing below popularity baseline
- [Surprise maintenance status](https://surpriselib.com/) — "Starting from version 1.1.0 (September 2019), I will only maintain the package"
- [Surprise GitHub issues](https://github.com/NicolasHug/surprise) — Confirmed: bugfix only, no new features since 2019
- [Supabase security best practices](https://supabase.com/docs/guides/auth/row-level-security) — RLS and service key management
- [PostgreSQL double-booking prevention](https://www.postgresql.org/docs/current/explicit-locking.html) — Row locking for booking systems
- [Flask deployment warnings](https://flask.palletsprojects.com/en/stable/deploying/) — "Do not use the development server in production"
- [Gunicorn deployment guide](https://docs.gunicorn.org/en/stable/deploy.html) — Production WSGI configuration
- [Supabase query performance](https://supabase.com/docs/guides/platform/performance) — Index optimization and query analysis
- [Hotel booking domain research — Academic papers on recommender systems in hospitality](https://scholar.google.com/scholar?q=hotel+recommendation+system+collaborative+filtering)
