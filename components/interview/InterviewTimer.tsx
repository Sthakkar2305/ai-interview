"use client"

import { useEffect, useState, useRef } from "react"
import { Clock } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface InterviewTimerProps {
  durationSeconds: number
  onTimeUp: () => void
  resetKey: string | number // change this to reset the timer (e.g. current question index)
}

export function InterviewTimer({ durationSeconds, onTimeUp, resetKey }: InterviewTimerProps) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Reset timer when resetKey changes
    setTimeLeft(durationSeconds)
    
    if (timerRef.current) clearInterval(timerRef.current)
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          onTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [durationSeconds, onTimeUp, resetKey])

  const percentage = (timeLeft / durationSeconds) * 100
  const isLow = timeLeft < Math.min(30, durationSeconds * 0.2) // Less than 30s or 20% left

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className={`flex items-center gap-4 bg-background p-3 rounded-lg border shadow-sm transition-colors duration-500 ${isLow ? 'border-red-500/50 bg-red-50 dark:bg-red-950/20' : 'border-border'}`}>
      <div className={`flex items-center gap-2 font-mono text-xl font-bold ${isLow ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
        <Clock className={`w-5 h-5 ${isLow ? 'animate-pulse' : 'text-muted-foreground'}`} />
        {formatTime(timeLeft)}
      </div>
      <div className="flex-1 w-full max-w-[200px]">
        <Progress 
          value={percentage} 
          className="h-2"
          indicatorClassName={isLow ? 'bg-red-500' : 'bg-primary'} 
        />
      </div>
    </div>
  )
}
