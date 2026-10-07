import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The app's one skeleton system.
 *
 * Every shape is a decorative (aria-hidden) gray block carrying the shared
 * `.skeleton` class from styles/index.css: a single 1.6s translateX shimmer
 * sweep, so all shapes in a view move as one synchronized pass. Reduced
 * motion gets the static fill. Helpers below suggest the destination layout
 * (same card sizes, row heights, grid columns) without copying every detail.
 */

export type SkeletonVariant = "block" | "line" | "circle"

export function Skeleton({
  className,
  variant = "block",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: SkeletonVariant }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "skeleton",
        variant === "line" && "h-4 rounded-[8px]",
        variant === "block" && "rounded-[8px]",
        variant === "circle" && "rounded-full",
        className,
      )}
      {...props}
    />
  )
}

/** A line of text — 16px tall by default. */
export function SkeletonLine({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <Skeleton variant="line" className={cn("h-4", className)} {...props} />
}

/** An avatar / icon circle. */
export function SkeletonCircle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <Skeleton variant="circle" className={cn("size-10", className)} {...props} />
}

/** A card / image block — size it with className to match the destination. */
export function SkeletonBlock({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <Skeleton variant="block" className={className} {...props} />
}

/**
 * Card-shaped skeleton: the destination's white card chrome with suggested
 * gray lines inside — optionally an image block on top or an avatar title
 * row, enough to hint the layout without replicating every detail.
 */
export function SkeletonCard({
  className,
  media = false,
  avatar = false,
  lines = 3,
}: {
  className?: string
  media?: boolean
  avatar?: boolean
  lines?: number
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white", className)}
    >
      {media && <Skeleton className="aspect-[16/9] w-full rounded-none" />}
      <div className="space-y-2.5 p-5">
        {avatar ? (
          <div className="flex items-center gap-3">
            <SkeletonCircle className="size-8" />
            <div className="space-y-1.5">
              <SkeletonLine className="h-3.5 w-28" />
              <SkeletonLine className="h-2.5 w-36" />
            </div>
          </div>
        ) : (
          <SkeletonLine className="h-4 w-1/3" />
        )}
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonLine key={i} className="h-3 w-full" />
        ))}
      </div>
    </div>
  )
}

/** One data-table row (avatar + nine cells) at the real row height. */
export function SkeletonTableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr aria-hidden="true" className={cn("border-b border-[#f0f1f3]", className)} {...props}>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <SkeletonCircle className="size-8" />
          <div className="space-y-1.5">
            <SkeletonLine className="h-3.5 w-28" />
            <SkeletonLine className="h-2.5 w-36" />
          </div>
        </div>
      </td>
      <td className="px-5 py-3">
        <SkeletonLine className="h-3 w-24" />
      </td>
      <td className="px-5 py-3">
        <SkeletonLine className="h-3 w-16" />
      </td>
      <td className="px-5 py-3">
        <SkeletonLine className="h-3 w-20" />
      </td>
      <td className="px-5 py-3">
        <SkeletonLine className="h-3 w-24" />
      </td>
      <td className="px-5 py-3">
        <SkeletonLine className="h-3 w-14" />
      </td>
      <td className="px-5 py-3 text-right">
        <SkeletonLine className="ml-auto h-3 w-16" />
      </td>
      <td className="px-5 py-3">
        <SkeletonLine className="h-3 w-16" />
      </td>
      <td className="px-5 py-3">
        <SkeletonLine className="ml-auto h-5 w-14" />
      </td>
    </tr>
  )
}

/**
 * Loading region wrapper: aria-busy while skeletons show, over a persistent
 * aria-live container so the swap to real content is announced once. The
 * destination fades in (`.content-fade`, opacity only, instant under reduced
 * motion); skeletons inside are aria-hidden and stay silent.
 */
export function SkeletonRegion({
  loading,
  className,
  wrapperClassName,
  children,
}: {
  loading: boolean
  className?: string
  wrapperClassName?: string
  children: ReactNode
}) {
  return (
    <div aria-busy={loading} className={wrapperClassName}>
      <div aria-live="polite" className={cn(className, !loading && "content-fade")}>
        {children}
      </div>
    </div>
  )
}
