import hotelLogo from "@/assets/images/Hotel Ava logo.png"

/**
 * Centered Hotel Ava logo settings for qrcode.react.
 *
 * Keeps the logo at ~20% of the QR width (≈4% of its area) with `excavate`,
 * which stays well inside the recovery budget of error-correction level "Q"
 * (25%) — the QR remains scannable with the logo overlaid.
 */
export function qrLogoSettings(size: number) {
  const w = Math.round(size * 0.2)
  return { src: hotelLogo, width: w, height: w, excavate: true }
}
