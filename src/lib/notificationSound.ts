/**
 * Two-tone chime for a new notification.
 *
 * Synthesised with WebAudio so there is no audio asset to ship or preload, and
 * the AudioContext is only unlocked on the first user gesture — browsers block
 * sound that starts before the visitor has interacted with the page.
 */

let ctx: AudioContext | null = null
let unlocked = false

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) {
    try {
      ctx = new Ctor()
    } catch {
      return null
    }
  }
  return ctx
}

/** Called from the first click / keypress of the session. */
export function unlockNotificationSound() {
  const ac = ensureContext()
  if (!ac) return
  unlocked = true
  if (ac.state === "suspended") void ac.resume()
}

function blip(ac: AudioContext, at: number, freq: number, gain: number) {
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  osc.type = "sine"
  osc.frequency.value = freq
  amp.gain.setValueAtTime(0.0001, at)
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.02)
  amp.gain.exponentialRampToValueAtTime(0.0001, at + 0.3)
  osc.connect(amp).connect(ac.destination)
  osc.start(at)
  osc.stop(at + 0.32)
}

/** Play the chime. Silently does nothing before the first gesture. */
export function playNotificationSound() {
  if (!unlocked) return
  try {
    const ac = ensureContext()
    if (!ac) return
    if (ac.state === "suspended") void ac.resume()
    const now = ac.currentTime
    blip(ac, now, 880, 0.13)
    blip(ac, now + 0.13, 1318.51, 0.1)
  } catch {
    // Sound is a nice-to-have — never let it break a notification.
  }
}
