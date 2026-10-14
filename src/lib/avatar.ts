// Flat-illustration avatar set — free MIT-licensed art from
// github.com/alohe/avatars, served via jsDelivr CDN. Animated people only
// (no real faces). Replaces the old cartoon DiceBear generator.

const AVATAR_CDN = "https://cdn.jsdelivr.net/gh/alohe/avatars/png"

// Curated: memo (35) + teams (9) + upstream (22) = 66 flat illustrations
export const AVATAR_LIST: string[] = [
  ...Array.from({ length: 35 }, (_, i) => `memo_${i + 1}.png`),
  ...Array.from({ length: 9 }, (_, i) => `teams_${i + 1}.png`),
  ...Array.from({ length: 22 }, (_, i) => `upstream_${i + 1}.png`),
]

export function getAvatarUrl(filename: string): string {
  return `${AVATAR_CDN}/${filename}`
}

function hashSeed(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

// Deterministic avatar for a given seed (guest name/email) — stable per user.
export function getGeneratedAvatar(seed: string): string {
  return getAvatarUrl(AVATAR_LIST[hashSeed(seed) % AVATAR_LIST.length])
}

// Final onError fallback: inline SVG, zero network dependency.
export const DEFAULT_AVATAR_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#efe9df"/><circle cx="32" cy="25" r="11" fill="#b9ada0"/><path d="M10 58c3-13 11-20 22-20s19 7 22 20" fill="#b9ada0"/></svg>`,
  )

// Stored avatars saved before this change were DiceBear cartoon URLs —
// remap them on display so no DB migration is needed.
export function isLegacyAvatar(url: string | null | undefined): boolean {
  return !!url && url.includes("dicebear")
}

export function getStoredAvatar(url: string | null | undefined): string {
  return url && !isLegacyAvatar(url) ? url : ""
}

export function getDisplayAvatar(url: string | null | undefined, seed: string): string {
  if (!url) return ""
  if (isLegacyAvatar(url)) return getGeneratedAvatar(seed)
  return url
}

// Two-stage onError: stored photo -> generated illustration -> inline SVG.
export function onAvatarError(e: { currentTarget: HTMLImageElement }, seed: string): void {
  const el = e.currentTarget
  const generated = getGeneratedAvatar(seed)
  if (el.src !== generated) {
    el.src = generated
  } else {
    el.onerror = null
    el.src = DEFAULT_AVATAR_SVG
  }
}
