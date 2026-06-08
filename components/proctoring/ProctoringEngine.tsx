"use client"

import { useEffect, useState, useRef, RefObject } from "react"
import { getSupabaseClient } from "@/lib/supabase-client"
import * as tf from "@tensorflow/tfjs"
import { AlertCircle, ShieldAlert, MonitorOff } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export interface ProctoringEngineProps {
  sessionId: string
  isActive: boolean
  onTerminate: () => void
  videoRef: RefObject<HTMLVideoElement | null>
}

export function ProctoringEngine({ sessionId, isActive, onTerminate, videoRef }: ProctoringEngineProps) {
  const supabase = getSupabaseClient()
  
  const [detector, setDetector] = useState<any>(null)
  const [warningMessage, setWarningMessage] = useState("")
  const [violationCount, setViolationCount] = useState(0)
  const [debugFaceCount, setDebugFaceCount] = useState<number | null>(null)
  
  const faceMissingStrikesRef = useRef(0)
  const faceMissingStartRef = useRef<number | null>(null)
  const isCheckingRef = useRef(false)
  const isTerminatedRef = useRef(false)

  // Initialize TF.js and Face Detection model
  useEffect(() => {
    async function initDetector() {
      try {
        console.log("Initializing TF.js...")
        await tf.ready()
        
        // Attach tf to window so the CDN script can find it
        ;(window as any).tf = tf

        // Load face-detection script dynamically to avoid Turbopack bundling issues
        if (!(window as any).faceDetection) {
          console.log("Loading face detection script...")
          const script = document.createElement("script")
          script.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/face-detection"
          script.async = true
          document.body.appendChild(script)
          
          await new Promise((resolve, reject) => {
            script.onload = resolve
            script.onerror = () => reject(new Error("Failed to load face detection model"))
          })
        }

        console.log("Creating detector...")
        const faceDetection = (window as any).faceDetection
        const model = faceDetection.SupportedModels.MediaPipeFaceDetector
        const detectorConfig = {
          runtime: "tfjs",
          maxFaces: 5,
        }
        const newDetector = await faceDetection.createDetector(model, detectorConfig)
        console.log("Detector created successfully:", newDetector)
        setDetector(newDetector)
      } catch (err) {
        console.error("Failed to initialize Face Detection:", err)
      }
    }
    initDetector()
  }, [])

  // Start webcam: Removed internal camera request. We now rely on the parent videoElement.
  useEffect(() => {
    // We just wait for the parent to provide the video feed
  }, [isActive])

  // Capture screenshot and upload to Supabase storage
  const uploadEvidence = async (fileName: string): Promise<string | null> => {
    if (!videoRef?.current) return null
    try {
      const videoElement = videoRef.current
      const canvas = document.createElement("canvas")
      canvas.width = videoElement.videoWidth || 320
      canvas.height = videoElement.videoHeight || 240
      const ctx = canvas.getContext("2d")
      if (!ctx) return null
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
      
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.7))
      if (!blob) return null

      const filePath = `${sessionId}/${Date.now()}_${fileName}.jpg`
      const { error } = await supabase.storage.from("proctoring-evidence").upload(filePath, blob)
      if (error) {
        console.error("Storage upload error:", error)
        return null
      }
      
      const { data: publicUrlData } = supabase.storage.from("proctoring-evidence").getPublicUrl(filePath)
      return publicUrlData.publicUrl
    } catch (e) {
      console.error("Evidence upload failed:", e)
      return null
    }
  }

  const handleTermination = async (reason: string, violationType: string) => {
    if (isTerminatedRef.current) return
    isTerminatedRef.current = true

    setWarningMessage(`CRITICAL VIOLATION: ${reason}. Interview is immediately terminated.`)
    const screenshotUrl = await uploadEvidence(violationType)
    await logViolation(violationType, reason, "critical", screenshotUrl)
    
    await supabase.from("interview_sessions").update({ 
      session_status: "terminated",
      failure_reason: reason 
    }).eq("id", sessionId)
    
    setTimeout(() => onTerminate(), 2000)
  }

  // Proctoring checks: Tab switch and Fullscreen (ULTRA STRICT)
  useEffect(() => {
    if (!isActive) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleTermination("Tab switching or browser minimization detected.", "tab_switch")
      }
    }

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleTermination("Exited fullscreen mode.", "exited_fullscreen")
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    document.addEventListener("fullscreenchange", handleFullscreenChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [isActive, sessionId])

  // Custom event listener for Multiple Voices from Transcription
  useEffect(() => {
    if (!isActive) return
    const handleVoiceViolation = () => {
      handleTermination("Multiple human voices detected in the background.", "multiple_voices")
    }
    window.addEventListener("multiple_voices_detected", handleVoiceViolation)
    return () => window.removeEventListener("multiple_voices_detected", handleVoiceViolation)
  }, [isActive])

  // Proctoring checks: Face detection loop
  useEffect(() => {
    if (!isActive || !detector || !videoRef?.current || isTerminatedRef.current) return

    let animationFrameId: number

    const detectFaces = async () => {
      const videoElement = videoRef?.current
      if (videoElement && videoElement.readyState === 4 && !isCheckingRef.current && !isTerminatedRef.current) {
        isCheckingRef.current = true
        try {
          const faces = await detector.estimateFaces(videoElement)
          const now = Date.now()
          
          // Throttled UI update for debugging
          if (now % 10 === 0) setDebugFaceCount(faces.length)

          if (faces.length === 0) {
            // Face missing logic (0.8 second grace period to reduce false positives)
            if (!faceMissingStartRef.current) {
              faceMissingStartRef.current = now
            } else if (now - faceMissingStartRef.current > 800) {
              faceMissingStrikesRef.current += 1
              if (faceMissingStrikesRef.current >= 3) {
                handleTermination("Face not detected in camera frame repeatedly.", "eye_contact_lost")
              } else {
                const strikeCount = faceMissingStrikesRef.current
                const screenshot = await uploadEvidence("face_missing_warning")
                logViolation("face_missing_warning", `Face missing or looking away (Strike ${strikeCount})`, "high", screenshot)
                const warningsLeft = 3 - strikeCount
                setWarningMessage(`Please look directly at the screen. ${warningsLeft} more warning${warningsLeft === 1 ? '' : 's'} will terminate the interview.`)
                setTimeout(() => setWarningMessage(""), 5000)
              }
              faceMissingStartRef.current = null // reset timer
            }
          } else if (faces.length > 1) {
            // Multiple faces -> INSTANT TERMINATION
            handleTermination("Multiple faces detected in the camera frame.", "multiple_faces")
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

    // Start detection
    detectFaces()
    
    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [isActive, detector, videoRef])

  const triggerWarning = (msg: string) => {
    setWarningMessage(msg)
    setTimeout(() => setWarningMessage(""), 5000)
  }

  const logViolation = async (type: string, description: string, severity: string, screenshotUrl: string | null = null) => {
    try {
      await supabase.from("violation_logs").insert([{
        session_id: sessionId,
        violation_type: type,
        description,
        severity,
        screenshot_url: screenshotUrl
      }])
    } catch (e) {
      console.error("Failed to log violation", e)
    }
  }

  const requestFullscreen = () => {
    document.documentElement.requestFullscreen().catch(() => {})
  }

  if (!isActive) return null

  return (
    <>
      {/* Face Detection Debug Overlay */}
      <div className="fixed bottom-4 left-4 z-[100] bg-black/80 text-white text-xs px-3 py-1.5 rounded-full font-mono shadow-lg border border-white/20">
        AI Scanner: {debugFaceCount !== null ? `${debugFaceCount} Face(s) Detected` : 'Initializing...'}
      </div>

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
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  )
}
