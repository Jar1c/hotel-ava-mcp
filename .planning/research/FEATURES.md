# Feature Landscape

**Domain:** Hotel Reservation and Recommendation System
**Researched:** 2026-06-23

---

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Search with date range + guests** | Every hotel site has this. Users need check-in/out dates and guest count to start. | Medium | Date range picker + guest selector. react-day-picker range mode + Shadcn Popover. |
| **Room grid / list view** | Browse available rooms with photos, price, amenities. Sortable by price, rating. | Low | Tailwind grid. TanStack Query for data. |
| **Room detail page** | Photos, description, amenities list, price breakdown, reviews, booking CTA. | Low | React Router route param. Static until Phase 3. |
| **Booking form** | Guest info, special requests, payment (stub), confirm booking. | Medium | React Hook Form + Zod schema. Multi-step or single-page. |
| **Check-in/check-out calendar** | Visual availability calendar on room detail. Red dates = booked. | Medium | Custom react-day-picker with `modifiers.booked` prop. |
| **Search filters** | Price range, star rating, amenities (WiFi, pool, breakfast), room type. | Low-Medium | URL query params for shareable search. Zustand for filter state. |
| **Responsive design** | Mobile-first. Hotel searches are heavily mobile. | Low | Tailwind responsive prefixes. Mobile-first layout. |
| **Admin: Booking list** | See all bookings, filter by date/status, cancel bookings. | Low | Table view. TanStack Query with pagination. |
| **Admin: Room management** | CRUD for rooms, set prices, mark unavailable dates. | Medium | React Hook Form + Zod. Date blocking. |
| **User authentication** | Login/signup, guest checkout option. | Medium | Supabase Auth + supabase-py. PKCE flow for Flask. |

---

## Differentiators

Features that set the product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Personalized room recommendations** | "Guests like you also booked..." Based on past booking patterns and preferences. | High | Hybrid approach: content-based (room attributes) + collaborative filtering (booking similarity). |
| **Smart alternatives** | "This room is booked, but these 3 similar rooms are available." Prevents bounce on unavailable rooms. | Medium | Cosine similarity on room attribute vectors. scikit-learn `cosine_similarity`. |
| **Destination recommendations** | "Based on your search, consider these destinations." Cross-sell alternative locations. | Medium | Content-based on location attributes, distance, amenities. |
| **Revenue forecasting** | "Next quarter: projected $142K (+12% YoY)." Predictive admin analytics. | High | ARIMA/SARIMA on historical booking data. Prophet for holiday effects. |
| **Occupancy prediction** | "December occupancy predicted at 87% — consider dynamic pricing." | High | Time series + regression. scikit-learn + statsmodels. |
| **Price optimization suggestions** | "Market rate for this room type is $180/night. You're at $150." | High | Competitive analysis + demand forecasting. Requires external data. |
| **Booking patterns dashboard** | Heatmap of booking times, length-of-stay distribution, cancellation patterns. | Medium | Recharts heatmap or custom visualization. |
| **Availability calendar (admin)** | Monthly view of all room bookings with drag-to-block dates. | Medium | react-big-calendar for admin event-style view. |
| **Guest preference learning** | Track past guest preferences (room type, floor, amenities) and prioritize in search results. | Medium | User profile stored in Supabase. Simple query-level personalization. |
| **Instant availability check** | Real-time room availability without page reload. | Medium | Supabase realtime subscriptions for Redis-like live updates. |

---

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Real payment processing in Phase 1** | PCI compliance complexity. Premature before UI is validated. | Mock payment step with "Booking Confirmed" placeholder. Defer Stripe integration to Phase 3+. |
| **Full-text review search with NLP** | Expensive to build and maintain. Low value for MVP. | Basic keyword search on room descriptions is sufficient for Phase 1. |
| **Chatbot / virtual concierge** | High complexity, low validation. Hotels rarely need this. | Static FAQ section. Consider only if user research validates demand. |
| **Social login with 10+ providers** | Maintenance burden. Each provider needs OAuth setup and testing. | Google + email/password via Supabase Auth is sufficient. Expand only if conversion data shows need. |
| **Multi-language support in Phase 1** | i18n adds significant complexity (translations, RTL, date formats). Premature for MVP. | Build in English first. Extract strings for i18n preparation but don't ship translations. |
| **Dark mode** | Hotel booking UIs are almost universally light mode (photos, rooms). Dark mode adds styling complexity with zero booking conversion benefit. | Skip entirely unless specific user research demands it. |
| **Server-side rendering (Next.js)** | SSR adds deployment complexity, build time, and server costs. Hotel booking doesn't need SEO-critical pages (rooms are transactional, not content). | Vite SPA is simpler and sufficient. SEO for room pages is low priority. |
| **Blockchain / NFTs for bookings** | Zero user demand. Adds complexity without value. | Don't build this. |
| **Custom CMS for hotel content** | Building a CMS from scratch is a massive project. | Use Supabase Studio for content management. Add a simple admin form for room CRUD. |

---

## Feature Dependencies

```
Search                    ─────→ Room Grid        ─────→ Room Detail     ─────→ Booking Form
  (date range + guests)          (list results)           (full info)           (confirm)

Room Detail               ─────→ Booking Calendar
                                   (availability)

Admin Login               ─────→ Admin Dashboard
                                   (booking list, charts)

Booking Data (Phase 3)    ─────→ Recommendation Engine (Phase 4)
                                   (needs booking history)

Booking History (Phase 4) ─────→ Predictive Analytics (Phase 5)
                                   (needs sufficient data volume)

Auth (Phase 3)            ─────→ Personalization (Phase 4+)
                                   (needs user profiles)
```

---

## MVP Recommendation

### Phase 1 — Guest-Facing UI (Mock Data)

1. **Search bar** — Date range picker + guest selector + location/destination
2. **Room grid** — Room cards with photo, price, amenities, rating
3. **Room detail page** — Full info, photo gallery, amenities, availability calendar
4. **Booking form** — Guest info, special requests, confirm booking (mock success)
5. **Responsive design** — Mobile-first Tailwind layout
6. **Navigation** — React Router routes, header, footer

### Phase 2 — Admin Dashboard (Mock Data)

1. **Admin login** — Supabase auth (simple email/password)
2. **Booking list** — Table with sort, filter, status badges
3. **Revenue chart** — Recharts line/bar chart with mock data
4. **Occupancy chart** — Recharts area chart showing booking rates
5. **Room management** — CRUD form for room data

### Deferred to Phase 3+

| Feature | Phase | Reason |
|---------|-------|--------|
| Real backend integration | 3 | Need validated UI first |
| User authentication | 3 | Supabase Auth setup |
| Real booking persistence | 3 | Supabase database |
| Recommendation engine | 4 | Needs booking data |
| Predictive analytics | 5 | Needs historical data |
| Price optimization | 6 | Needs market research |

---

## Sources

- [Holidaze accommodation booking (Noroff project)](https://github.com/martink-rsa/noroff-project-exam-2) — Real hotel booking React app with similar stack
- [HotelBooking_UI (GitHub)](https://github.com/Flying-WhaleShark/HotelBooking_UI) — React+Vite+TypeScript hotel booking landing page
- [Hotel-Booking-Website (GitHub)](https://github.com/himuexe/Hotel-Booking-Website) — Full-stack hotel booking with React + Node.js (pattern reference)
- [@balby/booking-search npm package](https://www.npmjs.com/package/@balby/booking-search) — Booking.com-inspired React search component (2025-2026)
- [Collaborative Filtering for Hotel Booking (GitHub)](https://github.com/susanli2016/Machine-Learning-with-Python/blob/master/Collaborative%20Filtering%20RecSys%20with%20Implicit%20Data_Hotel%20booking.ipynb) — ML notebook showing hotel recommendation with ALS
- [Hotel-Recommender (GitHub)](https://github.com/alantancr/Hotel-Recommender) — Content-based hotel recommender using cosine similarity + Flask deployment
