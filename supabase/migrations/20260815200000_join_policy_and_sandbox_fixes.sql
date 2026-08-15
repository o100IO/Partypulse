-- Align guest table status with place_table_order RPC (expects 'open')
UPDATE public.guest_tables SET status = 'open' WHERE status = 'active';
ALTER TABLE public.guest_tables ALTER COLUMN status SET DEFAULT 'open';

-- Allow venue owners to create events (UI already exposes DJ create routes to them)
DROP POLICY IF EXISTS "DJs can create events" ON public.events;
CREATE POLICY "DJs and venue owners can create events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = dj_id
    AND (
      public.has_role(auth.uid(), 'dj')
      OR public.has_role(auth.uid(), 'venue_owner')
    )
  );

-- Host-controlled join policy for guest entry via QR/link
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS join_policy text NOT NULL DEFAULT 'open'
    CHECK (join_policy IN ('open', 'signed_in', 'ticket_required', 'code')),
  ADD COLUMN IF NOT EXISTS join_code text;

COMMENT ON COLUMN public.events.join_policy IS 'open | signed_in | ticket_required | code';
COMMENT ON COLUMN public.events.join_code IS 'Optional invite code when join_policy = code';

-- Re-allow venue owners to seed default menus from the app
GRANT EXECUTE ON FUNCTION public.seed_default_menu_items(uuid) TO authenticated;
