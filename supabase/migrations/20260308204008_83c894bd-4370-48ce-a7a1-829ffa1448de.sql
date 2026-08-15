
-- Announcements & discount alerts table
CREATE TABLE public.event_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'message', -- 'message' or 'discount'
  title TEXT NOT NULL,
  message TEXT,
  -- discount fields
  discount_percent INTEGER DEFAULT 0,
  discount_categories TEXT[] DEFAULT '{}',
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.event_announcements ENABLE ROW LEVEL SECURITY;

-- Anyone can view active announcements
CREATE POLICY "Anyone can view announcements"
  ON public.event_announcements FOR SELECT
  USING (true);

-- DJs can create announcements for their events
CREATE POLICY "DJs can create announcements"
  ON public.event_announcements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_announcements.event_id
        AND events.dj_id = auth.uid()
    )
  );

-- DJs can update announcements for their events
CREATE POLICY "DJs can update announcements"
  ON public.event_announcements FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_announcements.event_id
        AND events.dj_id = auth.uid()
    )
  );

-- DJs can delete announcements for their events
CREATE POLICY "DJs can delete announcements"
  ON public.event_announcements FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_announcements.event_id
        AND events.dj_id = auth.uid()
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_announcements;
