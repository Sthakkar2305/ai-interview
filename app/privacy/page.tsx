"use client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function PrivacyPage() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">AI Interview Platform</h1>
          <Button variant="ghost" onClick={() => router.back()}>Back</Button>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-4 py-12 prose dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        
        <h2>1. Information We Collect</h2>
        <p>We collect various types of information to provide and improve our AI Interview Platform:</p>
        <ul>
          <li><strong>Personal Information:</strong> Name, email address, and authentication credentials.</li>
          <li><strong>Interview Data:</strong> Audio recordings, transcriptions, text responses, and metadata related to interview performance.</li>
          <li><strong>Proctoring Data:</strong> Screen visibility states, fullscreen states, facial landmarks, and voice activity data used strictly for academic integrity monitoring. Screenshots may be captured and stored securely in the event of a violation.</li>
        </ul>
        
        <h2>2. How We Use Your Information</h2>
        <p>We use the collected information for various purposes:</p>
        <ul>
          <li>To provide, maintain, and evaluate interview sessions.</li>
          <li>To monitor for cheating or policy violations during an interview using AI-assisted proctoring.</li>
          <li>To generate feedback and scores for candidates.</li>
        </ul>
        
        <h2>3. Proctoring and Automated Decision Making</h2>
        <p>Our platform uses automated systems to monitor interviews. This includes analyzing audio for multiple voices and video for multiple faces or loss of eye contact. If a violation is detected, the session may be automatically terminated based on predefined rules set by the recruiter.</p>

        <h2>4. Data Retention and Security</h2>
        <p>We retain your data only for as long as necessary for the purposes set out in this Privacy Policy. We employ industry-standard security measures to protect your personal data, including encryption of sensitive information in transit and at rest.</p>

        <h2>5. Sharing of Data</h2>
        <p>We do not sell your personal data. We may share your data with the specific recruiter or organization that scheduled your interview. We also use trusted third-party service providers (such as Deepgram for audio transcription) under strict confidentiality agreements.</p>

        <h2>6. Your Rights</h2>
        <p>You have the right to access, update, or delete the information we have on you. Please contact support to exercise these rights.</p>

        <h2>7. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact the platform administration.</p>
      </main>
    </div>
  )
}
