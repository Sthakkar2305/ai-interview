"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, ExternalLink } from "lucide-react"

export function ResumeMakerCard() {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <FileText className="w-32 h-32" />
      </div>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <FileText className="h-5 w-5" />
          Pro Resume Maker
        </CardTitle>
        <CardDescription>
          Create a stunning, ATS-friendly resume in minutes with our advanced resume builder.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          className="w-full sm:w-auto gap-2 shadow-md"
          onClick={() => window.open("https://cv-maker-two-livid.vercel.app/", "_blank")}
        >
          Build Resume Now <ExternalLink className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}
