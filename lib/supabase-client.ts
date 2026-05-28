import { createBrowserClient } from "@supabase/ssr"

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    )
  }
  return supabaseClient
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
        }
        Update: {
          email?: string
          full_name?: string | null
        }
      }
      interviews: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          document_url: string | null
          document_name: string | null
          interview_type: string
          manual_qa: Array<{ question: string; expectedAnswer: string }> | null
          created_at: string
          updated_at: string
        }
      }
      interview_sessions: {
        Row: {
          id: string
          interview_id: string
          user_id: string
          status: string
          started_at: string
          completed_at: string | null
          overall_score: number | null
          knowledge_score: number | null
          communication_score: number | null
          confidence_score: number | null
          technical_depth_score: number | null
          created_at: string
          updated_at: string
        }
      }
      interview_questions: {
        Row: {
          id: string
          interview_id: string
          question_text: string
          difficulty_level: string
          category: string | null
          expected_keywords: string[] | null
          created_at: string
        }
      }
      interview_answers: {
        Row: {
          id: string
          session_id: string
          question_id: string
          answer_text: string | null
          answer_audio_url: string | null
          transcript: string | null
          duration_seconds: number | null
          confidence_rating: number | null
          content_score: number | null
          clarity_score: number | null
          keyword_match: number | null
          created_at: string
        }
      }
      interview_feedback: {
        Row: {
          id: string
          session_id: string
          strengths: string[] | null
          weaknesses: string[] | null
          missed_concepts: string[] | null
          improvement_suggestions: string[] | null
          vocabulary_upgrades: Record<string, string> | null
          tips_to_improve: string[] | null
          created_at: string
        }
      }
      document_uploads: {
        Row: {
          id: string
          user_id: string
          interview_id: string
          file_name: string
          file_size: number | null
          file_type: string | null
          extracted_content: string | null
          topics: string[] | null
          key_concepts: Record<string, unknown> | null
          difficulty_assessment: string | null
          created_at: string
          updated_at: string
        }
      }
    }
  }
}
