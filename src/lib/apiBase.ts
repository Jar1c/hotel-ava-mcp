/**
 * Where the frontend sends API requests.
 *
 * Vercel serves the Python app on the same origin, so the default is `/api`.
 * Vercel env vars are often copied straight from a local .env, where the value
 * is `http://localhost:5000/api` - shipping that to production makes every
 * request hit the visitor's own machine, so a localhost value is ignored
 * outside of dev.
 */
const configured = (import.meta.env.VITE_API_URL || "").trim()
const pointsAtLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(configured)

export const API_BASE: string =
  configured && (import.meta.env.DEV || !pointsAtLocalhost) ? configured : "/api"
