import { useCallback, useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Camera, QrCode } from "lucide-react"
import jsQR from "jsqr"

type CameraState = "off" | "on" | "unsupported" | "denied"

type Detector = {
  detect(source: HTMLVideoElement | HTMLImageElement): Promise<Array<{ rawValue: string }>>
}
type BarcodeCtor = new (opts: { formats: string[] }) => Detector

interface QrScannerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fires once with the raw decoded payload when a QR code is read. */
  onResult: (raw: string) => void
  title?: string
  hint?: string
}

/**
 * Reusable camera QR scanner (mirrors VerifyQrDialog's camera handling).
 * Uses the native BarcodeDetector where available, jsQR pixel decoding as the
 * fallback everywhere else. Releases the camera whenever closed.
 */
export default function QrScannerDialog({
  open,
  onOpenChange,
  onResult,
  title = "Scan QR code",
  hint = "Point your camera at the QR code.",
}: QrScannerDialogProps) {
  const [cam, setCam] = useState<CameraState>("off")
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Keep the latest callback without re-running the decode loop on re-renders.
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  })

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    rafRef.current = null
    timerRef.current = null
    for (const track of streamRef.current?.getTracks() ?? []) track.stop()
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCam((prev) => (prev === "on" ? "off" : prev))
  }, [])

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCam("unsupported")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      streamRef.current = stream
      setCam("on")
    } catch {
      setCam("denied")
    }
  }, [])

  // Open → ask for the camera; close → release it.
  useEffect(() => {
    if (open) {
      setCam("off")
      void startCamera()
    } else {
      stopCamera()
    }
  }, [open, startCamera, stopCamera])

  // Live decode loop while the camera runs.
  useEffect(() => {
    if (cam !== "on") return
    const video = videoRef.current
    if (!video) return

    let cancelled = false
    video.srcObject = streamRef.current
    void video.play().catch(() => {})

    const Ctor = (window as unknown as { BarcodeDetector?: BarcodeCtor }).BarcodeDetector

    if (Ctor) {
      // Native decoder (Chrome/Edge) — per-frame.
      const detector = new Ctor({ formats: ["qr_code"] })
      const tick = async () => {
        if (cancelled) return
        try {
          const codes = await detector.detect(video)
          const raw = codes[0]?.rawValue
          if (raw) {
            stopCamera()
            onResultRef.current(raw)
            return
          }
        } catch {
          // Frame not ready yet — keep scanning.
        }
        if (!cancelled) rafRef.current = requestAnimationFrame(() => void tick())
      }
      rafRef.current = requestAnimationFrame(() => void tick())
    } else {
      // jsQR pixel fallback (Safari/Firefox) — sample ~5x per second.
      const canvas = (canvasRef.current ??= document.createElement("canvas"))
      timerRef.current = window.setInterval(() => {
        if (cancelled || !video.videoWidth) return
        canvas.width = 320
        canvas.height = Math.round((video.videoHeight / video.videoWidth) * 320)
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) return
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const raw = jsQR(pixels.data, pixels.width, pixels.height)?.data
          if (raw) {
            stopCamera()
            onResultRef.current(raw)
          }
        } catch {
          // Frame not ready yet — keep scanning.
        }
      }, 200)
    }

    return () => {
      cancelled = true
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
      rafRef.current = null
      timerRef.current = null
    }
  }, [cam, stopCamera])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!rounded-[16px] !max-w-[400px] !p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-hairline">
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="p-6">
          <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[10px] bg-[#0f1115]">
            {cam === "on" ? (
              <>
                <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-8 rounded-[12px] border-2 border-white/60" />
              </>
            ) : (
              <div className="px-5 text-center">
                <Camera className="h-6 w-6 text-white/70 mx-auto" />
                <p className="mt-2 text-xs text-white/70">
                  {cam === "unsupported"
                    ? "Camera scanning isn't supported in this browser — enter the code manually."
                    : cam === "denied"
                      ? "Camera access was blocked. Allow it in your browser, or enter the code manually."
                      : "Starting camera…"}
                </p>
                {cam === "denied" && (
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="mt-3 cursor-pointer text-xs font-semibold text-white underline"
                  >
                    Try again
                  </button>
                )}
              </div>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-muted">{hint}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
