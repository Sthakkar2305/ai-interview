import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, Loader2, Target, CheckCircle2, ArrowRight, Sparkles, FileText, ChevronRight, X, AlertTriangle } from "lucide-react"
import { parseDocument } from "@/lib/document-parser"

interface Improvement {
  id: string
  originalText: string
  suggestedChange: string
  type: "metrics" | "formatting" | "keywords" | "clarity" | string
}

export function CandidateAtsChecker() {
  const [file, setFile] = useState<File | null>(null)
  const [jobDescription, setJobDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [improvements, setImprovements] = useState<Improvement[]>([])
  const [resumeText, setResumeText] = useState("")
  const [error, setError] = useState("")
  
  // Interactive highlighting states
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false)
  const [selectedImprovementId, setSelectedImprovementId] = useState<string | null>(null)
  const [hoveredImprovementId, setHoveredImprovementId] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setScore(null)
      setImprovements([])
      setResumeText("")
      setError("")
      setIsWorkspaceOpen(false)
    }
  }

  const handleCheckScore = async () => {
    if (!file) {
      setError("Please upload your resume PDF")
      return
    }

    setLoading(true)
    setError("")
    setScore(null)
    setImprovements([])
    setResumeText("")
    setIsWorkspaceOpen(false)

    try {
      const parsedData = await parseDocument(file)
      const text = parsedData.text
      setResumeText(text)
      
      const res = await fetch("/api/candidate-ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: text, jobDescription }),
      })

      if (!res.ok) {
        throw new Error("Failed to analyze resume")
      }

      const data = await res.json()
      if (data.score !== undefined) {
        setScore(data.score)
        setImprovements(data.improvements || [])
        setIsWorkspaceOpen(true)
      } else {
        throw new Error(data.error || "Failed to get score")
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const renderHighlightedText = () => {
    if (!resumeText || improvements.length === 0) return resumeText

    // Find all valid occurrences of improvements in the text
    const matches: Array<{ start: number; end: number; improvement: Improvement }> = []
    
    improvements.forEach((imp) => {
      if (!imp.originalText || imp.originalText.trim().length < 3) return
      
      let index = resumeText.indexOf(imp.originalText)
      while (index !== -1) {
        // Ensure this match does not overlap with an already registered match
        const isOverlapping = matches.some(
          (m) => (index >= m.start && index < m.end) || (index + imp.originalText.length > m.start && index + imp.originalText.length <= m.end)
        );
        
        if (!isOverlapping) {
          matches.push({
            start: index,
            end: index + imp.originalText.length,
            improvement: imp,
          })
        }
        
        index = resumeText.indexOf(imp.originalText, index + 1)
      }
    })

    // Sort matches by start position ascending
    matches.sort((a, b) => a.start - b.start)

    // Build the nodes
    const nodes: React.ReactNode[] = []
    let lastIndex = 0

    matches.forEach((match, idx) => {
      // Add text before the match
      if (match.start > lastIndex) {
        nodes.push(resumeText.slice(lastIndex, match.start))
      }

      const isSelected = selectedImprovementId === match.improvement.id
      const isHovered = hoveredImprovementId === match.improvement.id
      
      let highlightClass = "bg-yellow-500/20 border-yellow-500/50 dark:bg-yellow-500/10 hover:bg-yellow-500/30"
      if (match.improvement.type === "metrics") {
        highlightClass = "bg-blue-500/20 border-blue-500/50 dark:bg-blue-500/10 hover:bg-blue-500/30"
      } else if (match.improvement.type === "keywords") {
        highlightClass = "bg-emerald-500/20 border-emerald-500/50 dark:bg-emerald-500/10 hover:bg-emerald-500/30"
      } else if (match.improvement.type === "formatting") {
        highlightClass = "bg-purple-500/20 border-purple-500/50 dark:bg-purple-500/10 hover:bg-purple-500/30"
      }

      if (isSelected || isHovered) {
        highlightClass += " ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-zinc-950 font-semibold"
      }

      nodes.push(
        <span
          key={`highlight-${idx}`}
          className={`cursor-pointer border-b-2 rounded transition-all duration-200 px-0.5 inline-block ${highlightClass}`}
          onClick={() => setSelectedImprovementId(match.improvement.id)}
          onMouseEnter={() => setHoveredImprovementId(match.improvement.id)}
          onMouseLeave={() => setHoveredImprovementId(null)}
        >
          {resumeText.slice(match.start, match.end)}
        </span>
      )

      lastIndex = match.end
    })

    // Add remaining text
    if (lastIndex < resumeText.length) {
      nodes.push(resumeText.slice(lastIndex))
    }

    return nodes
  }

  const getCategoryColor = (type: string) => {
    switch (type) {
      case "metrics":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
      case "keywords":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      case "formatting":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
      default:
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20"
    }
  }

  return (
    <>
      <div className="group bg-white dark:bg-[#111425] border border-border/40 hover:border-violet-500/50 hover:shadow-2xl hover:shadow-violet-600/5 transition-all duration-300 rounded-2xl p-8 flex flex-col relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-600/10 to-indigo-600/10 rounded-full blur-xl group-hover:scale-125 transition-transform" />
        
        <div className="p-4 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-2xl w-fit mb-6 transition-transform group-hover:scale-110">
           <Target className="h-7 w-7" />
        </div>

        <div className="space-y-2 mb-6 relative z-10">
          <h3 className="text-xl font-bold flex items-center gap-2 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
            ATS Resume Score Checker
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1.5" />
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Upload your resume and an optional target job description to instantly find out your ATS match score (out of 100).
          </p>
        </div>

        <div className="space-y-5 relative z-10 flex-1 flex flex-col justify-end">
          {error && <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800/30">{error}</div>}
          
          {score !== null ? (
            <div className="space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="flex flex-col items-center justify-center p-6 bg-violet-500/5 rounded-xl border border-violet-500/20 space-y-2">
                <div className="flex items-center gap-2">
                   <CheckCircle2 className="h-8 w-8 text-violet-500" />
                   <span className="text-4xl font-bold text-foreground">{score}</span>
                   <span className="text-xl text-muted-foreground">/ 100</span>
                </div>
                <p className="text-sm font-medium text-violet-600 dark:text-violet-400">Your ATS Match Score</p>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1 h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold shadow-md" onClick={() => setIsWorkspaceOpen(true)}>
                  Interactive Audit Dashboard
                </Button>
                <Button variant="outline" className="h-11" onClick={() => { setScore(null); setImprovements([]); setResumeText(""); setIsWorkspaceOpen(false); }}>
                  Reset
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">Target Job Description</Label>
                <Textarea 
                  placeholder="Paste the job description here (optional)..."
                  value={jobDescription}
                  onChange={e => setJobDescription(e.target.value)}
                  className="min-h-[80px] bg-transparent border-border/50 focus:border-violet-500/50 resize-none"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">Upload Resume (PDF)</Label>
                <div className="flex items-center gap-4">
                  <Input 
                    type="file" 
                    accept=".pdf" 
                    onChange={handleFileChange}
                    disabled={loading}
                    className="flex-1 bg-transparent border-border/50 focus:border-violet-500/50 file:text-violet-600 dark:file:text-violet-400"
                  />
                </div>
              </div>

              <Button onClick={handleCheckScore} disabled={loading || !file} className="w-full h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold shadow-md mt-2">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {loading ? "Analyzing Document..." : "Calculate ATS Score"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Full-Screen Workspace Portal/Modal */}
      {score !== null && isWorkspaceOpen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col p-6 lg:p-10 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-300">
          
          {/* Header Navigation */}
          <div className="flex items-center justify-between border-b pb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-xl">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  ATS Resume Audit Workspace
                  <span className="text-xs bg-violet-500/10 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full font-mono font-semibold uppercase">Live Audit</span>
                </h2>
                <p className="text-sm text-muted-foreground">Compare, highlight, and adjust resume content for maximum score compatibility.</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5 bg-violet-500/5 border border-violet-500/20 px-5 py-2.5 rounded-2xl">
                <CheckCircle2 className="h-5 w-5 text-violet-500" />
                <span className="text-2xl font-extrabold text-foreground">{score}</span>
                <span className="text-sm text-muted-foreground">/ 100 Score</span>
              </div>

              <Button 
                variant="ghost" 
                size="icon" 
                className="h-11 w-11 rounded-full border hover:bg-muted"
                onClick={() => setIsWorkspaceOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Main Side-by-Side Workspace */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0 mt-8">
            
            {/* Left: Document text panel */}
            <div className="lg:col-span-7 flex flex-col h-full bg-muted/20 dark:bg-muted/5 border rounded-2xl p-6 min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" /> Parsed Resume Text (Interactive)
                </span>
                <span className="text-xs text-muted-foreground italic">Click highlighted text to view details</span>
              </div>
              
              <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950 p-8 rounded-xl border border-border/40 shadow-inner font-mono text-sm leading-relaxed whitespace-pre-wrap select-text">
                {renderHighlightedText()}
              </div>
            </div>

            {/* Right: Improvement suggestions panel */}
            <div className="lg:col-span-5 flex flex-col h-full min-h-0 overflow-hidden">
              <div className="mb-4">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  ATS Recommendations ({improvements.length})
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {improvements.map((imp) => {
                  const isSelected = selectedImprovementId === imp.id
                  const isHovered = hoveredImprovementId === imp.id
                  
                  return (
                    <div
                      key={imp.id}
                      className={`group/card border rounded-2xl p-5 transition-all duration-300 cursor-pointer ${
                        isSelected 
                          ? "bg-violet-500/5 border-violet-500 ring-2 ring-violet-500/20" 
                          : isHovered
                          ? "bg-muted/50 border-border/80 scale-[1.01]" 
                          : "bg-white dark:bg-[#111425] border-border/40 hover:border-border/80"
                      }`}
                      onClick={() => setSelectedImprovementId(imp.id)}
                      onMouseEnter={() => setHoveredImprovementId(imp.id)}
                      onMouseLeave={() => setHoveredImprovementId(null)}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-xl border ${getCategoryColor(imp.type)}`}>
                          {imp.type === "metrics" ? (
                            <span className="text-xs font-extrabold">#</span>
                          ) : imp.type === "keywords" ? (
                            <Sparkles className="h-4 w-4" />
                          ) : imp.type === "formatting" ? (
                            <FileText className="h-4 w-4" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                        </div>

                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{imp.type}</span>
                            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isSelected ? "translate-x-1 text-violet-500" : ""}`} />
                          </div>

                          <div className="text-xs italic bg-muted/40 dark:bg-muted/10 p-2.5 rounded border border-border/50 font-mono text-foreground/75 leading-relaxed line-clamp-2">
                            "{imp.originalText}"
                          </div>

                          <p className="text-sm text-foreground/90 font-medium leading-relaxed">
                            {imp.suggestedChange}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
