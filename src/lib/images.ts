// Photo-review helpers — Shopee-style reviews attach up to 5 photos.

export const MAX_REVIEW_IMAGES = 5
export const MAX_REVIEW_IMAGE_BYTES = 5 * 1024 * 1024 // keep in sync with backend/app.py
const MAX_EDGE = 1280 // longest side after resize
const JPEG_QUALITY = 0.82

export const REVIEW_ACCEPT = "image/jpeg,image/png,image/webp,image/gif"

/**
 * Downscale + re-encode a photo before upload so a phone camera shot doesn't
 * cost megabytes. Falls back to the original file when it can't be decoded or
 * when re-encoding wouldn't make it smaller.
 */
export async function compressImage(file: File): Promise<File> {
  if (file.type === "image/gif" || typeof createImageBitmap === "undefined") return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    bitmap.close()
    return file
  }
  ctx.fillStyle = "#ffffff" // JPEG has no alpha — keeps transparent PNGs from going black
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  )
  if (!blob || blob.size >= file.size) return file

  const base = file.name.replace(/\.\w+$/, "") || "photo"
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() })
}

export interface PickedImages {
  files: File[]
  /** Human-readable reason when some picks were dropped, else "" */
  rejected: string
}

/** Enforce the type/size/count limits, then compress what's left.
 *
 * `reserved` counts photos already kept elsewhere (e.g. on a review being
 * edited) so the combined total never exceeds MAX_REVIEW_IMAGES. */
export async function pickReviewImages(
  current: File[],
  incoming: FileList | File[],
  reserved = 0,
): Promise<PickedImages> {
  const files = [...current]
  const limit = Math.max(0, MAX_REVIEW_IMAGES - reserved)
  let rejected = ""

  for (const file of Array.from(incoming)) {
    if (files.length >= limit) {
      rejected = `You can attach up to ${MAX_REVIEW_IMAGES} photos.`
      break
    }
    if (!/^image\//.test(file.type)) {
      rejected = "Only JPG, PNG, WebP or GIF photos are allowed."
      continue
    }
    if (file.size > MAX_REVIEW_IMAGE_BYTES) {
      rejected = "Each photo must be 5 MB or smaller."
      continue
    }
    files.push(await compressImage(file))
  }

  return { files, rejected }
}
