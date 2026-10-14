import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"
import { downpaymentOnline } from "@/lib/payment"

/**
 * Booking receipt, normalised from either shape:
 *  - guest booking  (`userBookingsApi.getOne`)
 *  - admin booking  (`BookingsTable` selected row)
 *
 * `total` is always the VAT-inclusive amount shown everywhere else in the app,
 * so the receipt breaks it back down instead of inventing new numbers.
 */
export interface ReceiptData {
  /** Short reference printed as the receipt number, e.g. "FC793B14" */
  reference: string
  /** Full booking id, printed small at the bottom for traceability */
  fullReference?: string
  issuedAt?: string | null
  guestName: string
  guestEmail?: string
  guestPhone?: string
  roomName: string
  roomDetail?: string
  checkInLabel: string
  checkOutLabel?: string
  /** e.g. "2 nights" or "Day use · 4 hours from 3:00 PM" */
  stayLabel: string
  guests?: number
  /** Amount charged, VAT inclusive */
  total: number
  /** Room charge before VAT (rate × qty) — only when it can be derived */
  gross?: number | null
  /** Label for the charge line, e.g. "Standard Room 2 × 2 nights" */
  itemLabel: string
  paymentMethod?: string
  paymentStatus?: string
  /** "full" or "downpayment" — downpayment = 50% online, balance at the hotel */
  paymentMode?: string
  /** Collected online so far. Defaults to `total` when omitted. */
  amountPaid?: number
  /** Still owed at the hotel. Computed from `amountPaid` when omitted. */
  balanceDue?: number
  /** Set when the money went back to the guest after a cancellation. */
  refundedAt?: string | null
}

export interface ReceiptDialogProps {
  open: boolean
  onClose: () => void
  data: ReceiptData
}

/** Plain number — the receipt prints no currency symbol. */
const amount = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function formatStamp(iso?: string | null, withTime = false): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(
    "en-US",
    withTime
      ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric", year: "numeric" },
  )
}

function Dashed() {
  return <div className="my-2.5 border-t border-dashed border-black/30" />
}

function Row({
  label,
  value,
  bold,
  className = "",
}: {
  label: string
  value: string
  bold?: boolean
  className?: string
}) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <span className="shrink-0 text-[#6b7280]">{label}</span>
      <span className={`min-w-0 break-words text-right ${bold ? "font-bold" : ""}`}>{value}</span>
    </div>
  )
}

export default function ReceiptDialog({ open, onClose, data }: ReceiptDialogProps) {
  const total = Math.max(0, data.total || 0)
  // The app charges subtotal + 12% VAT, so invert that to split the receipt.
  const vat = Math.round((total / 1.12) * 0.12)
  const net = total - vat
  const gross = data.gross && data.gross > 0 ? data.gross : net
  const discount = Math.max(0, gross - net)

  // Downpayment bookings print what was handed over online and what went to
  // the front desk — amount_paid is the sum, so split it back after a settle.
  const isDownpayment = data.paymentMode === "downpayment"
  const paid = isDownpayment ? Math.max(0, data.amountPaid ?? 0) : total
  const balance = isDownpayment ? Math.max(0, data.balanceDue ?? total - paid) : 0
  const partial = isDownpayment && balance > 0
  const online = isDownpayment ? Math.min(paid, downpaymentOnline(total)) : total
  const atHotel = isDownpayment ? Math.max(0, paid - online) : 0

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="!max-w-[420px] !rounded-[16px] border-hairline bg-canvas !p-0 shadow-none ring-0">
        {/* Title bar — hidden when printing */}
        <DialogHeader className="no-print border-b border-hairline px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-primary" />
            Receipt
          </DialogTitle>
        </DialogHeader>

        <div className="receipt-scroll max-h-[70vh] overflow-y-auto p-5">
          <div className="receipt-print mx-auto w-full max-w-[340px] border border-dashed border-black/40 bg-white p-5 font-mono text-[12px] leading-relaxed text-[#1a1d26]">
            {/* Letterhead */}
            <div className="text-center">
              <p className="font-display text-[22px] font-bold tracking-[0.2em]">HOTEL AVA</p>
              <p className="mt-0.5 text-[10px] text-[#6b7280]">Malate · Manila · Philippines</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-widest">Official Receipt</p>
            </div>

            <Dashed />

            <Row label="Receipt No." value={data.reference} bold />
            <Row label="Date issued" value={formatStamp(data.issuedAt, true)} />
            <Row label="Payment" value={(data.paymentStatus || "—").toUpperCase()} bold />

            <Dashed />

            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">
              Billed to
            </p>
            <Row label="Guest" value={data.guestName} />
            {data.guestEmail && <Row label="Email" value={data.guestEmail} />}
            {data.guestPhone && <Row label="Phone" value={data.guestPhone} />}

            <Dashed />

            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">
              Stay details
            </p>
            <Row label="Room" value={`${data.roomName}${data.roomDetail ? ` (${data.roomDetail})` : ""}`} />
            <Row label="Check-in" value={data.checkInLabel} />
            {data.checkOutLabel && <Row label="Check-out" value={data.checkOutLabel} />}
            <Row label="Length" value={data.stayLabel} />
            {typeof data.guests === "number" && (
              <Row label="Guests" value={`${data.guests} ${data.guests === 1 ? "guest" : "guests"}`} />
            )}

            <Dashed />

            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">
              Charges
            </p>
            <Row label={data.itemLabel} value={amount(gross)} />
            {discount > 0 && <Row label="Discount" value={`-${amount(discount)}`} />}
            <Row label="VAT (12%)" value={amount(vat)} />

            <Dashed />

            <div className="flex items-center justify-between gap-3 text-[13px] font-bold">
              <span>TOTAL</span>
              <span>{amount(total)}</span>
            </div>

            {isDownpayment && (
              <>
                <Row label="Paid online (50%)" value={amount(online)} />
                <Row
                  label={partial ? "Balance due at the hotel" : "Settled at the hotel"}
                  value={amount(partial ? balance : atHotel)}
                  bold={partial}
                  className={partial ? "text-[#b45309]" : ""}
                />
              </>
            )}

            <Dashed />

            <Row label="Payment method" value={data.paymentMethod || "N/A"} />
            {isDownpayment && (
              <Row label="Payment terms" value="Downpayment" />
            )}
            {data.refundedAt && (
              <Row
                label="Refund"
                value={`Sent ${formatStamp(data.refundedAt, true)}`}
                className="text-[#3D6B4F]"
              />
            )}

            <Dashed />

            <p className="text-center text-[11px] font-bold">Thank you for staying with us!</p>
            <p className="mt-1 text-center text-[9px] text-[#6b7280]">
              Computer-generated receipt · no signature required
            </p>
            {data.fullReference && (
              <p className="mt-1 break-all text-center text-[9px] text-[#9ca3af]">
                Booking ID: {data.fullReference}
              </p>
            )}
          </div>
        </div>

        {/* Actions — hidden when printing */}
        <div className="no-print flex gap-3 border-t border-hairline p-4">
          <Button variant="outline" onClick={onClose} className="flex-1 !rounded-[8px]">
            Close
          </Button>
          <Button
            onClick={() => window.print()}
            className="flex-1 !rounded-[8px] bg-primary text-canvas hover:opacity-90"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print / Save PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
