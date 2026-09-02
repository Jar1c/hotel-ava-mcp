import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

export type ThemeMode = "light" | "dark" | "system"

export type ColorPreset =
  | "royal-plum"
  | "ocean-blue"
  | "forest-green"
  | "sunset-orange"
  | "rose-gold"
  | "midnight"

interface ThemeContextValue {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  colorPreset: ColorPreset
  setColorPreset: (preset: ColorPreset) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY_MODE = "ava-theme-mode"
const STORAGE_KEY_COLOR = "ava-color-preset"

function getSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function applyTheme(mode: ThemeMode, colorPreset: ColorPreset) {
  const root = document.documentElement

  // Color preset
  root.setAttribute("data-color-preset", colorPreset)

  // Dark mode
  let isDark = false
  if (mode === "dark") {
    isDark = true
  } else if (mode === "system") {
    isDark = getSystemDark()
  }
  root.classList.toggle("dark", isDark)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY_MODE) as ThemeMode) || "light"
    } catch {
      return "light"
    }
  })

  const [colorPreset, setColorPresetState] = useState<ColorPreset>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY_COLOR) as ColorPreset) || "royal-plum"
    } catch {
      return "royal-plum"
    }
  })

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    try { localStorage.setItem(STORAGE_KEY_MODE, m) } catch {}
  }, [])

  const setColorPreset = useCallback((p: ColorPreset) => {
    setColorPresetState(p)
    try { localStorage.setItem(STORAGE_KEY_COLOR, p) } catch {}
  }, [])

  // Apply on every change
  useEffect(() => {
    applyTheme(mode, colorPreset)
  }, [mode, colorPreset])

  // Listen for system preference changes when mode is "system"
  useEffect(() => {
    if (mode !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => applyTheme(mode, colorPreset)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [mode, colorPreset])

  return (
    <ThemeContext.Provider value={{ mode, setMode, colorPreset, setColorPreset }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
