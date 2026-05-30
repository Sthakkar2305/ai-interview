-- AI Interview Platform - Production Upgrade Schema Updates

-- 1. Modify interview_sessions to support the timer and new proctoring logic
ALTER TABLE public.interview_sessions 
ADD COLUMN IF NOT EXISTS timer_state JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS processing_status VARCHAR DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS failure_reason TEXT,
ADD COLUMN IF NOT EXISTS session_status VARCHAR DEFAULT 'active', -- 'active', 'terminated', 'expired', 'completed'
ADD COLUMN IF NOT EXISTS suspicious_activity_score FLOAT DEFAULT 0.0;

-- 2. Create scheduled_interviews table
CREATE TABLE IF NOT EXISTS public.scheduled_interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recruiter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    role VARCHAR NOT NULL,
    interview_type VARCHAR NOT NULL, -- 'document' or 'manual'
    difficulty VARCHAR NOT NULL,
    duration_minutes INTEGER NOT NULL,
    question_categories JSONB DEFAULT '[]'::jsonb,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    access_token VARCHAR NOT NULL UNIQUE,
    status VARCHAR DEFAULT 'scheduled', -- 'scheduled', 'active', 'completed', 'expired', 'terminated'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    document_url TEXT,
    document_name TEXT,
    manual_qa JSONB
);

-- 3. Create proctoring_events table
CREATE TABLE IF NOT EXISTS public.proctoring_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    event_type VARCHAR NOT NULL, -- e.g., 'tab_switch', 'face_missing', 'multiple_faces'
    confidence_score FLOAT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create violation_logs table
CREATE TABLE IF NOT EXISTS public.violation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
    violation_type VARCHAR NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR NOT NULL, -- 'low', 'medium', 'high', 'critical'
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Add RLS Policies for the new tables
ALTER TABLE public.scheduled_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.violation_logs ENABLE ROW LEVEL SECURITY;

-- Scheduled interviews policies
CREATE POLICY "Recruiters can view their scheduled interviews" 
ON public.scheduled_interviews FOR SELECT 
USING (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can insert scheduled interviews" 
ON public.scheduled_interviews FOR INSERT 
WITH CHECK (auth.uid() = recruiter_id);

CREATE POLICY "Candidates can read scheduled interviews by token"
ON public.scheduled_interviews FOR SELECT
USING (true); -- We will enforce token validation in the application logic

-- Proctoring events policies
CREATE POLICY "Users can insert their own proctoring events"
ON public.proctoring_events FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.interview_sessions 
    WHERE id = session_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their own proctoring events"
ON public.proctoring_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.interview_sessions 
    WHERE id = session_id AND user_id = auth.uid()
  )
);

-- Violation logs policies
CREATE POLICY "Users can insert their own violation logs"
ON public.violation_logs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.interview_sessions 
    WHERE id = session_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their own violation logs"
ON public.violation_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.interview_sessions 
    WHERE id = session_id AND user_id = auth.uid()
  )
);

-- Add some index for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_interviews_token ON public.scheduled_interviews(access_token);
CREATE INDEX IF NOT EXISTS idx_proctoring_events_session ON public.proctoring_events(session_id);
CREATE INDEX IF NOT EXISTS idx_violation_logs_session ON public.violation_logs(session_id);

-- 6. Add Pass/Fail System and Strict Proctoring Fields
ALTER TABLE public.scheduled_interviews ADD COLUMN IF NOT EXISTS passing_marks INTEGER DEFAULT 70;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS passing_marks INTEGER DEFAULT 70;

ALTER TABLE public.violation_logs ADD COLUMN IF NOT EXISTS screenshot_url TEXT;
ALTER TABLE public.violation_logs ADD COLUMN IF NOT EXISTS audio_metadata JSONB;

-- 7. Create Storage Bucket for Proctoring Evidence
INSERT INTO storage.buckets (id, name, public) VALUES ('proctoring-evidence', 'proctoring-evidence', true) ON CONFLICT DO NOTHING;
