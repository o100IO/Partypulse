
-- Create venue_menu_items table
CREATE TABLE public.venue_menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT NOT NULL DEFAULT '🍹',
  price_cents INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'drinks',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.venue_menu_items ENABLE ROW LEVEL SECURITY;

-- Anyone can view active menu items
CREATE POLICY "Anyone can view active menu items"
ON public.venue_menu_items
FOR SELECT
USING (is_active = true);

-- Venue owners can insert menu items
CREATE POLICY "Venue owners can insert menu items"
ON public.venue_menu_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.venues
    WHERE venues.id = venue_menu_items.venue_id
      AND venues.owner_id = auth.uid()
  )
);

-- Venue owners can update menu items
CREATE POLICY "Venue owners can update menu items"
ON public.venue_menu_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.venues
    WHERE venues.id = venue_menu_items.venue_id
      AND venues.owner_id = auth.uid()
  )
);

-- Venue owners can delete menu items
CREATE POLICY "Venue owners can delete menu items"
ON public.venue_menu_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.venues
    WHERE venues.id = venue_menu_items.venue_id
      AND venues.owner_id = auth.uid()
  )
);

-- Updated_at trigger
CREATE TRIGGER update_venue_menu_items_updated_at
BEFORE UPDATE ON public.venue_menu_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed function for default menu items
CREATE OR REPLACE FUNCTION public.seed_default_menu_items(p_venue_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only seed if venue has no menu items yet
  IF NOT EXISTS (SELECT 1 FROM venue_menu_items WHERE venue_id = p_venue_id) THEN
    INSERT INTO venue_menu_items (venue_id, name, emoji, price_cents, category, sort_order) VALUES
      (p_venue_id, 'Beer', '🍺', 500, 'drinks', 1),
      (p_venue_id, 'Cocktail', '🍸', 1200, 'drinks', 2),
      (p_venue_id, 'Shot', '🥃', 800, 'drinks', 3),
      (p_venue_id, 'Bottle Service', '🍾', 15000, 'bottles', 4),
      (p_venue_id, 'Water', '💧', 300, 'drinks', 5);
  END IF;
END;
$$;

-- Points-based tip function
CREATE OR REPLACE FUNCTION public.send_points_tip(
  p_from_user_id UUID,
  p_to_user_id UUID,
  p_event_id UUID,
  p_amount_cents INTEGER,
  p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_balance INTEGER;
  v_tip_id UUID;
  v_points_cost INTEGER;
BEGIN
  -- Convert cents to points (1 point = 1 cent for simplicity)
  v_points_cost := p_amount_cents;

  -- Get current balance with row lock
  SELECT points_balance INTO v_current_balance
  FROM profiles
  WHERE user_id = p_from_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  IF v_current_balance < v_points_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient points', 'balance', v_current_balance);
  END IF;

  -- Deduct points
  UPDATE profiles
  SET points_balance = points_balance - v_points_cost,
      updated_at = now()
  WHERE user_id = p_from_user_id;

  -- Insert tip
  INSERT INTO tips (from_user_id, to_user_id, event_id, amount_cents, tip_type, message)
  VALUES (p_from_user_id, p_to_user_id, p_event_id, p_amount_cents, 'points', p_message)
  RETURNING id INTO v_tip_id;

  -- Create point transaction
  INSERT INTO point_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (p_from_user_id, -v_points_cost, 'spent', 'Tip sent', v_tip_id);

  RETURN jsonb_build_object(
    'success', true,
    'tip_id', v_tip_id,
    'points_spent', v_points_cost,
    'new_balance', (SELECT points_balance FROM profiles WHERE user_id = p_from_user_id)
  );
END;
$$;
