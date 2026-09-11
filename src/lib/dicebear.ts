// DiceBear avatar styles - curated selection for hotel system
export interface DiceBearStyle {
  id: string
  name: string
  category: "character" | "abstract" | "pixel" | "fun"
}

export const DICEBEAR_STYLES: DiceBearStyle[] = [
  // Character styles (MLBB-like)
  { id: "adventurer", name: "Adventurer", category: "character" },
  { id: "adventurer-neutral", name: "Adventurer Neutral", category: "character" },
  { id: "avataaars", name: "Avataaars", category: "character" },
  { id: "big-smile", name: "Big Smile", category: "character" },
  { id: "lorelei", name: "Lorelei", category: "character" },
  { id: "micah", name: "Micah", category: "character" },
  { id: "notionists", name: "Notionists", category: "character" },
  { id: "open-peeps", name: "Open Peeps", category: "character" },
  { id: "personas", name: "Personas", category: "character" },
  { id: "toon-head", name: "Toon Head", category: "character" },
  // Abstract styles
  { id: "bottts", name: "Bottts", category: "abstract" },
  { id: "bottts-neutral", name: "Bottts Neutral", category: "abstract" },
  { id: "identicon", name: "Identicon", category: "abstract" },
  { id: "rings", name: "Rings", category: "abstract" },
  { id: "shapes", name: "Shapes", category: "abstract" },
  { id: "marbles", name: "Marbles", category: "abstract" },
  // Pixel styles
  { id: "pixel-art", name: "Pixel Art", category: "pixel" },
  { id: "pixel-art-neutral", name: "Pixel Art Neutral", category: "pixel" },
  // Fun styles
  { id: "fun-emoji", name: "Fun Emoji", category: "fun" },
  { id: "thumbs", name: "Thumbs", category: "fun" },
]

const DICEBEAR_BASE = "https://api.dicebear.com/10.x"

export function getDiceBearUrl(style: string, seed: string, size = 128): string {
  return `${DICEBEAR_BASE}/${style}/svg?seed=${encodeURIComponent(seed)}&size=${size}`
}

// Generate a random style from the list
export function getRandomStyle(): string {
  const idx = Math.floor(Math.random() * DICEBEAR_STYLES.length)
  return DICEBEAR_STYLES[idx].id
}

// Generate avatar URL for a user (used on registration)
export function generateUserAvatar(email: string): string {
  const style = getRandomStyle()
  return getDiceBearUrl(style, email)
}
