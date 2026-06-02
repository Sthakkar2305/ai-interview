"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Check, Loader2 } from "lucide-react"
import { approveCompanyAction } from "@/app/admin/actions"

export function ApproveCompanyButton({ userId, companyName }: { userId: string, companyName: string }) {
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleApprove = async () => {
    if (confirm(`Are you sure you want to approve the company profile for ${companyName}?`)) {
      setLoading(true)
      const res = await approveCompanyAction(userId)
      if (res.success) {
        startTransition(() => {
          router.refresh()
        })
      } else {
        alert(res.error)
      }
      setLoading(false)
    }
  }

  return (
    <Button 
      variant="outline"
      size="sm"
      onClick={handleApprove} 
      disabled={isPending || loading}
      className="text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-900/20"
    >
      {(isPending || loading) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
      Approve
    </Button>
  )
}
