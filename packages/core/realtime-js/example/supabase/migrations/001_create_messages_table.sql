-- Messages table for chat persistence
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room TEXT NOT NULL,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS with anonymous access for this demo
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read messages" ON public.messages
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert messages" ON public.messages
  FOR INSERT WITH CHECK (true);

-- Index for efficient queries
CREATE INDEX idx_messages_room ON public.messages(room, created_at DESC);

-- Enable Realtime on the messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
