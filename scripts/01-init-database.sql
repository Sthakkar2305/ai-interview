-- Create profiles table for user data
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create interviews table
CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  document_url TEXT,
  document_name TEXT,
  interview_type TEXT DEFAULT 'document', -- document, manual, practice, stress
  manual_qa JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create interview sessions (actual interview attempts)
CREATE TABLE IF NOT EXISTS interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'in_progress', -- in_progress, completed, abandoned
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  overall_score NUMERIC(5,2),
  knowledge_score NUMERIC(5,2),
  communication_score NUMERIC(5,2),
  confidence_score NUMERIC(5,2),
  technical_depth_score NUMERIC(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create questions table (AI-generated questions for interviews)
CREATE TABLE IF NOT EXISTS interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  difficulty_level TEXT DEFAULT 'medium', -- easy, medium, hard, stress
  category TEXT,
  expected_keywords TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create answers table (candidate responses)
CREATE TABLE IF NOT EXISTS interview_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  answer_audio_url TEXT,
  transcript TEXT,
  duration_seconds INTEGER,
  confidence_rating NUMERIC(3,2),
  content_score NUMERIC(5,2),
  clarity_score NUMERIC(5,2),
  keyword_match NUMERIC(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create feedback table
CREATE TABLE IF NOT EXISTS interview_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  strengths TEXT[],
  weaknesses TEXT[],
  missed_concepts TEXT[],
  improvement_suggestions TEXT[],
  vocabulary_upgrades JSONB,
  tips_to_improve TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create document uploads table
CREATE TABLE IF NOT EXISTS document_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT, -- pdf, docx, doc
  extracted_content TEXT,
  topics TEXT[],
  key_concepts JSONB,
  difficulty_assessment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for interviews
CREATE POLICY "Users can view their own interviews"
  ON interviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create interviews"
  ON interviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interviews"
  ON interviews FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for interview_sessions
CREATE POLICY "Users can view their own sessions"
  ON interview_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create sessions"
  ON interview_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON interview_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for interview_questions
CREATE POLICY "Users can view questions for their interviews"
  ON interview_questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM interviews WHERE interviews.id = interview_questions.interview_id AND interviews.user_id = auth.uid()
  ));

CREATE POLICY "Users can create questions for their interviews"
  ON interview_questions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM interviews WHERE interviews.id = interview_questions.interview_id AND interviews.user_id = auth.uid()
  ));

-- RLS Policies for interview_answers
CREATE POLICY "Users can view their own answers"
  ON interview_answers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM interview_sessions WHERE interview_sessions.id = interview_answers.session_id AND interview_sessions.user_id = auth.uid()
  ));

CREATE POLICY "Users can create answers"
  ON interview_answers FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM interview_sessions WHERE interview_sessions.id = session_id AND interview_sessions.user_id = auth.uid()
  ));

-- RLS Policies for interview_feedback
CREATE POLICY "Users can view their own feedback"
  ON interview_feedback FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM interview_sessions WHERE interview_sessions.id = interview_feedback.session_id AND interview_sessions.user_id = auth.uid()
  ));

CREATE POLICY "Users can create their own feedback"
  ON interview_feedback FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM interview_sessions WHERE interview_sessions.id = interview_feedback.session_id AND interview_sessions.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own feedback"
  ON interview_feedback FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM interview_sessions WHERE interview_sessions.id = interview_feedback.session_id AND interview_sessions.user_id = auth.uid()
  ));

-- RLS Policies for document_uploads
CREATE POLICY "Users can view their own documents"
  ON document_uploads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upload documents"
  ON document_uploads FOR INSERT
  WITH CHECK (auth.uid() = user_id);
