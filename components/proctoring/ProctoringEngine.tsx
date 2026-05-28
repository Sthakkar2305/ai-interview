"use client"

import { useEffect, useState, useRef } from "react"
import { getSupabaseClient } from "@/lib/supabase-client"
import * as tf from "@tensorflow/tfjs"
import { AlertCircle, ShieldAlert, MonitorOff } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export interface ProctoringEngineProps {
  sessionId: string
  isActive: boolean
  onTerminate: () => void
}

export function ProctoringEngine({ sessionId, isActive, onTerminate }: ProctoringEngineProps) {
  const supabase = getSupabaseClient()
  const videoRef = useRef<HTMLVideoElement>(null)
  
  const [detector, setDetector] = useState<any>(null)
  const [warningMessage, setWarningMessage] = useState("")
  const [violationCount, setViolationCount] = useState(0)
  const MAX_VIOLATIONS = 5

  const violationCountRef = useRef(0)
  const faceMissingStartRef = useRef<number | null>(null)
  const isCheckingRef = useRef(false)

  // Initialize TF.js and Face Detection model
  useEffect(() => {
    async function initDetector() {
      await tf.ready()
      
      // Attach tf to window so the CDN script can find it
      ;(window as any).tf = tf

      // Load face-detection script dynamically to avoid Turbopack bundling issues
      if (!(window as any).faceDetection) {
        const script = document.createElement("script")
        script.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/face-detection"
        script.async = true
        document.body.appendChild(script)
        
        await new Promise((resolve, reject) => {
          script.onload = resolve
          script.onerror = () => reject(new Error("Failed to load face detection model"))
        })
      }

      const faceDetection = (window as any).faceDetection
      const model = faceDetection.SupportedModels.MediaPipeFaceDetector
      const detectorConfig = {
        runtime: "tfjs",
        maxFaces: 2,
      }
      const newDetector = await faceDetection.createDetector(model, detectorConfig)
      setDetector(newDetector)
    }
    initDetector()
  }, [])

  // Start webcam
  useEffect(() => {
    if (!isActive) return
    
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (err) {
        logViolation("camera_disabled", "Candidate denied or disabled camera access", "high")
        triggerWarning("Camera access is required for proctoring.")
      }
    }
    setupCamera()

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [isActive])

  // Proctoring checks: Tab switch and Fullscreen
  useEffect(() => {
    if (!isActive) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        logViolation("tab_switch", "Candidate switched tabs or minimized browser", "high")
        triggerWarning("Tab switching is not allowed during the interview.")
      }
    }

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        logViolation("exited_fullscreen", "Candidate exited fullscreen mode", "medium")
        triggerWarning("Please remain in fullscreen mode.")
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    document.addEventListener("fullscreenchange", handleFullscreenChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [isActive, sessionId])

  // Proctoring checks: Face detection loop
  useEffect(() => {
    if (!isActive || !detector || !videoRef.current) return

    const video = videoRef.current
    let animationFrameId: number

    const detectFaces = async () => {
      if (video.readyState === 4 && !isCheckingRef.current) {
        isCheckingRef.current = true
        try {
          const faces = await detector.estimateFaces(video)
          const now = Date.now()

          if (faces.length === 0) {
            // Face missing logic (allow 5 second grace period)
            if (!faceMissingStartRef.current) {
              faceMissingStartRef.current = now
            } else if (now - faceMissingStartRef.current > 5000) {
              logViolation("face_missing", "No face detected in camera for >5 seconds", "medium")
              triggerWarning("Please ensure your face is visible in the camera.")
              faceMissingStartRef.current = now // reset to avoid spam
            }
          } else if (faces.length > 1) {
            // Multiple faces
            logViolation("multiple_faces", "Multiple faces detected in frame", "high")
            triggerWarning("Multiple faces detected. You must be alone.")
            faceMissingStartRef.current = null
          } else {
            // Good state
            faceMissingStartRef.current = null
          }
        } catch (e) {
          // Ignore processing errors
        } finally {
          isCheckingRef.current = false
        }
      }
      animationFrameId = requestAnimationFrame(detectFaces)
    }

    video.addEventListener('loadeddata', detectFaces)
    
    return () => {
      video.removeEventListener('loadeddata', detectFaces)
      cancelAnimationFrame(animationFrameId)
    }
  }, [isActive, detector])

  const triggerWarning = (msg: string) => {
    setWarningMessage(msg)
    violationCountRef.current += 1
    setViolationCount(violationCountRef.current)
    
    if (violationCountRef.current >= MAX_VIOLATIONS) {
      handleTermination()
    } else {
      setTimeout(() => setWarningMessage(""), 5000)
    }
  }

  const logViolation = async (type: string, description: string, severity: string) => {
    try {
      await supabase.from("violation_logs").insert([{
        session_id: sessionId,
        violation_type: type,
        description,
        severity
      }])
    } catch (e) {
      console.error("Failed to log violation", e)
    }
  }

  const handleTermination = async () => {
    setWarningMessage("Maximum violations reached. The interview is being terminated.")
    await supabase.from("interview_sessions").update({ session_status: "terminated" }).eq("id", sessionId)
    onTerminate()
  }

  const requestFullscreen = () => {
    document.documentElement.requestFullscreen().catch(() => {})
  }

  if (!isActive) return null

  return (
    <>
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      
      {/* Hidden button to enforce fullscreen if needed, typically you'd bind this to the 'Start' button but we can put a small banner */}
      {!document.fullscreenElement && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-sm py-2 px-4 flex justify-between items-center z-50">
          <div className="flex items-center gap-2">
            <MonitorOff className="w-4 h-4" />
            <span>Fullscreen mode is required for this interview.</span>
          </div>
          <Button size="sm" variant="secondary" onClick={requestFullscreen}>Enable Fullscreen</Button>
        </div>
      )}

      {/* Warning Modal */}
      <Dialog open={!!warningMessage} onOpenChange={() => {}}>
        <DialogContent className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <ShieldAlert className="w-5 h-5" />
              Proctoring Warning
            </DialogTitle>
            <DialogDescription className="text-red-800 dark:text-red-200 text-base py-4 font-medium">
              {warningMessage}
            </DialogDescription>
            <div className="text-sm text-red-600/80">
              Violations: {violationCount} / {MAX_VIOLATIONS}
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  )
}
