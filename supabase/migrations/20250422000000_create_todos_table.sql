-- Create todos table
CREATE TABLE IF NOT EXISTS public.todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task TEXT NOT NULL,
    is_complete BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id)
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to read all todos (public data)
CREATE POLICY "Allow anonymous read access" ON public.todos
    FOR SELECT
    TO anon
    USING (true);

-- Allow anonymous users to insert todos (for backward compatibility with old tests)
CREATE POLICY "Allow anonymous insert access" ON public.todos
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Allow anonymous users to delete todos (for backward compatibility with old tests)
CREATE POLICY "Allow anonymous delete access" ON public.todos
    FOR DELETE
    TO anon
    USING (true);

-- Allow authenticated users to read their own todos
CREATE POLICY "Allow authenticated read own todos" ON public.todos
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Allow authenticated users to insert their own todos
CREATE POLICY "Allow authenticated insert own todos" ON public.todos
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own todos
CREATE POLICY "Allow authenticated update own todos" ON public.todos
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to delete their own todos
CREATE POLICY "Allow authenticated delete own todos" ON public.todos
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
