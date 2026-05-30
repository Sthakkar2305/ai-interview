"use client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function TermsPage() {
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
        <h1>Terms and Conditions</h1>
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing or using the AI Interview Platform, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you may not use our services.</p>
        
        <h2>2. Use of the Platform</h2>
        <p>Our platform provides AI-driven interview assessments and proctoring services. You agree to use these services only for lawful purposes and in accordance with these Terms.</p>
        
        <h2>3. Interview Proctoring</h2>
        <p>When participating in an interview, you acknowledge and consent to our strict proctoring mechanisms, which may include:</p>
        <ul>
          <li>Camera and microphone access to detect multiple faces or voices.</li>
          <li>Screen monitoring to prevent tab switching and exiting fullscreen mode.</li>
          <li>Head pose estimation and eye contact tracking.</li>
        </ul>
        <p>Violations of these proctoring rules will result in immediate termination of the interview session.</p>

        <h2>4. Data Privacy</h2>
        <p>Your privacy is important to us. We process your data, including audio and video recordings, in accordance with our Privacy Policy.</p>

        <h2>5. Intellectual Property</h2>
        <p>The platform and its original content, features, and functionality are owned by the AI Interview Platform and are protected by international copyright, trademark, and intellectual property laws.</p>

        <h2>6. Termination</h2>
        <p>We may terminate or suspend your access to the platform immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>

        <h2>7. Changes to Terms</h2>
        <p>We reserve the right to modify or replace these Terms at any time. Continued use of the platform after any such changes shall constitute your consent to such changes.</p>
      </main>
    </div>
  )
}
