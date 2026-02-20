-- supabase-js integration test schema
-- Used by e2e-tests/tests/supabase/integration.test.ts

-- Todos table for RLS and basic CRUD tests
CREATE TABLE IF NOT EXISTS public.todos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task text NOT NULL,
  is_complete boolean DEFAULT false NOT NULL,
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- Public (no user_id) todos visible to everyone; private todos visible only to their owner
CREATE POLICY "todos_select" ON public.todos
  FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);

-- Anyone can insert (anonymous inserts leave user_id NULL)
CREATE POLICY "todos_insert" ON public.todos
  FOR INSERT WITH CHECK (true);

-- Owner (or anonymous for public todos) can update
CREATE POLICY "todos_update" ON public.todos
  FOR UPDATE USING (user_id IS NULL OR auth.uid() = user_id);

-- Owner (or anonymous for public todos) can delete
CREATE POLICY "todos_delete" ON public.todos
  FOR DELETE USING (user_id IS NULL OR auth.uid() = user_id);

-- Storage bucket for supabase-js storage tests
INSERT INTO storage.buckets (id, name, public)
VALUES ('test-bucket', 'test-bucket', true)
ON CONFLICT (id) DO NOTHING;
