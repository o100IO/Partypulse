
-- 1. VIP Ticket Perks: add perk columns to event_tickets
ALTER TABLE public.event_tickets
  ADD COLUMN perk_drink_discount integer NOT NULL DEFAULT 0,
  ADD COLUMN perk_priority_queue boolean NOT NULL DEFAULT false,
  ADD COLUMN perk_bonus_votes integer NOT NULL DEFAULT 0;

-- 2. Event Themes: add theme columns to events
ALTER TABLE public.events
  ADD COLUMN theme_color text DEFAULT NULL,
  ADD COLUMN theme_bg_image text DEFAULT NULL,
  ADD COLUMN theme_logo_url text DEFAULT NULL;

-- 3. Live Chat: create event_chat_messages table
CREATE TABLE public.event_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid DEFAULT NULL,
  guest_name text DEFAULT 'Anonymous',
  message text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat RLS: anyone can view
CREATE POLICY "Anyone can view chat messages"
  ON public.event_chat_messages FOR SELECT
  USING (true);

-- Chat RLS: anyone can insert
CREATE POLICY "Anyone can send chat messages"
  ON public.event_chat_messages FOR INSERT
  WITH CHECK (true);

-- Chat RLS: DJs can update (pin/unpin)
CREATE POLICY "DJs can update chat messages"
  ON public.event_chat_messages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM events WHERE events.id = event_chat_messages.event_id AND events.dj_id = auth.uid()
  ));

-- Chat RLS: DJs can delete
CREATE POLICY "DJs can delete chat messages"
  ON public.event_chat_messages FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM events WHERE events.id = event_chat_messages.event_id AND events.dj_id = auth.uid()
  ));

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_chat_messages;

-- 4. Storage bucket for event assets
INSERT INTO storage.buckets (id, name, public) VALUES ('event-assets', 'event-assets', true);

-- Storage RLS: anyone can view
CREATE POLICY "Anyone can view event assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-assets');

-- Storage RLS: authenticated users can upload
CREATE POLICY "Authenticated users can upload event assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-assets' AND auth.role() = 'authenticated');

-- Storage RLS: owners can delete
CREATE POLICY "Users can delete own event assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'event-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 5. Helper function: get user ticket perks for an event
CREATE OR REPLACE FUNCTION public.get_user_ticket_perks(p_user_id uuid, p_event_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_build_object(
      'drink_discount', COALESCE(MAX(et.perk_drink_discount), 0),
      'priority_queue', COALESCE(bool_or(et.perk_priority_queue), false),
      'bonus_votes', COALESCE(MAX(et.perk_bonus_votes), 0)
    ),
    '{"drink_discount":0,"priority_queue":false,"bonus_votes":0}'::jsonb
  )
  FROM ticket_purchases tp
  JOIN event_tickets et ON et.id = tp.ticket_id
  WHERE tp.user_id = p_user_id AND tp.event_id = p_event_id AND et.is_active = true
$$;

-- 6. Leaderboard function
CREATE OR REPLACE FUNCTION public.get_event_leaderboard(p_event_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'top_voters', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.total_points DESC)
      FROM (
        SELECT
          v.user_id,
          COALESCE(p.display_name, 'Guest') as display_name,
          SUM(v.points_spent) as total_points,
          COUNT(*) as vote_count
        FROM votes v
        JOIN song_requests sr ON sr.id = v.request_id
        LEFT JOIN profiles p ON p.user_id = v.user_id
        WHERE sr.event_id = p_event_id AND v.user_id IS NOT NULL
        GROUP BY v.user_id, p.display_name
        ORDER BY total_points DESC
        LIMIT 5
      ) t
    ), '[]'::jsonb),
    'top_tippers', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.total_tips DESC)
      FROM (
        SELECT
          tips.from_user_id as user_id,
          COALESCE(p.display_name, 'Guest') as display_name,
          SUM(tips.amount_cents) as total_tips
        FROM tips
        LEFT JOIN profiles p ON p.user_id = tips.from_user_id
        WHERE tips.event_id = p_event_id AND tips.from_user_id IS NOT NULL
        GROUP BY tips.from_user_id, p.display_name
        ORDER BY total_tips DESC
        LIMIT 5
      ) t
    ), '[]'::jsonb),
    'top_requesters', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.request_count DESC)
      FROM (
        SELECT
          sr.guest_id as user_id,
          COALESCE(p.display_name, sr.guest_name, 'Guest') as display_name,
          COUNT(*) as request_count
        FROM song_requests sr
        LEFT JOIN profiles p ON p.user_id = sr.guest_id
        WHERE sr.event_id = p_event_id AND sr.guest_id IS NOT NULL
        GROUP BY sr.guest_id, p.display_name, sr.guest_name
        ORDER BY request_count DESC
        LIMIT 5
      ) t
    ), '[]'::jsonb)
  )
$$;
