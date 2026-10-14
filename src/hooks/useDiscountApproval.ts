import { useState, useEffect, useCallback } from "react"
import {
  getApprovedDiscounts as fetchApproved,
  approveDiscount as apiApprove,
  dismissDiscount as apiDismiss,
} from "@/services/discountService"

export function useDiscountApproval() {
  const [approvedKeys, setApprovedKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const keys = await fetchApproved()
    setApprovedKeys(keys)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const approve = useCallback(async (eventRoomTypeKey: string) => {
    await apiApprove(eventRoomTypeKey)
    setApprovedKeys((prev) => new Set([...prev, eventRoomTypeKey]))
  }, [])

  const dismiss = useCallback(async (eventRoomTypeKey: string) => {
    await apiDismiss(eventRoomTypeKey)
    setApprovedKeys((prev) => {
      const next = new Set(prev)
      next.delete(eventRoomTypeKey)
      return next
    })
  }, [])

  const isApproved = useCallback(
    (eventRoomTypeKey: string) => approvedKeys.has(eventRoomTypeKey),
    [approvedKeys]
  )

  return { approvedKeys, loading, approve, dismiss, isApproved, refresh }
}
