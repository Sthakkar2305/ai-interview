"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"
import { deleteUserAction, deleteSessionAction } from "@/app/admin/actions"

export function DeleteUserButton({ userId, userName }: { userId: string, userName: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!window.confirm(`CRITICAL WARNING: Are you sure you want to permanently delete the user "${userName}"? This will erase all their interviews, sessions, and data forever. This action CANNOT be undone.`)) {
      return
    }

    setLoading(true)
    const res = await deleteUserAction(userId)
    if (res.success) {
      startTransition(() => {
        router.refresh()
      })
    } else {
      alert("Failed to delete user: " + res.error)
      setLoading(false)
    }
  }

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={handleDelete} 
      disabled={isPending || loading}
      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
      title="Delete User"
    >
      {isPending || loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  )
}

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete this interview session? This action CANNOT be undone.`)) {
      return
    }

    setLoading(true)
    const res = await deleteSessionAction(sessionId)
    if (res.success) {
      startTransition(() => {
        router.refresh()
      })
    } else {
      alert("Failed to delete session: " + res.error)
      setLoading(false)
    }
  }

  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={handleDelete} 
      disabled={isPending || loading}
      className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/30 dark:hover:bg-red-900/20"
      title="Delete Session"
    >
      {isPending || loading ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Trash2 className="h-3 w-3 mr-1.5" />}
      Delete
    </Button>
  )
}
