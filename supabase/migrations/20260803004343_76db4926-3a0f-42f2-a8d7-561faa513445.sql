-- 1. Protect points_balance from direct client writes
CREATE OR REPLACE FUNCTION public.protect_profile_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.points_balance <> OLD.points_balance AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'points_balance cannot be modified directly';
  END IF;
  IF NEW.user_id <> OLD.user_id AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'user_id cannot be modified';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_balance ON public.profiles;
CREATE TRIGGER protect_profile_balance
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_balance();

-- 2. Tighten RLS write policies
DROP POLICY IF EXISTS "Anyone can create votes" ON public.votes;
CREATE POLICY "Guests can create free votes" ON public.votes
FOR INSERT TO anon, authenticated
WITH CHECK (
  points_spent = 0
  AND (user_id IS NULL OR user_id = auth.uid())
);

DROP POLICY IF EXISTS "Anyone can create tips" ON public.tips;
CREATE POLICY "Users can record own direct tips" ON public.tips
FOR INSERT TO authenticated
WITH CHECK (
  from_user_id = auth.uid()
  AND tip_type = 'direct'
  AND amount_cents > 0
  AND amount_cents <= 1000000
);

DROP POLICY IF EXISTS "Anyone can create song requests" ON public.song_requests;
CREATE POLICY "Anyone can create song requests" ON public.song_requests
FOR INSERT TO anon, authenticated
WITH CHECK (
  (guest_id IS NULL OR guest_id = auth.uid())
  AND vote_count = 0
  AND char_length(song_title) BETWEEN 1 AND 200
  AND (artist IS NULL OR char_length(artist) <= 200)
  AND (guest_name IS NULL OR char_length(guest_name) <= 60)
  AND (shoutout_message IS NULL OR char_length(shoutout_message) <= 300)
);

DROP POLICY IF EXISTS "Anyone can send chat messages" ON public.event_chat_messages;
CREATE POLICY "Anyone can send chat messages" ON public.event_chat_messages
FOR INSERT TO anon, authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND is_pinned = false
  AND char_length(message) BETWEEN 1 AND 500
  AND (guest_name IS NULL OR char_length(guest_name) <= 60)
);

DROP POLICY IF EXISTS "Users can update own tables" ON public.guest_tables;
CREATE POLICY "Users can update own tables" ON public.guest_tables
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "System can create transactions" ON public.point_transactions;
DROP POLICY IF EXISTS "Authenticated users can insert purchases" ON public.ticket_purchases;

DROP POLICY IF EXISTS "Users can insert own table orders" ON public.table_orders;

DROP POLICY IF EXISTS "Anyone can view venue staff" ON public.venue_staff;
CREATE POLICY "Signed in users can view venue staff" ON public.venue_staff
FOR SELECT TO authenticated
USING (true);

-- 3. Harden money-moving functions to use the caller's identity
CREATE OR REPLACE FUNCTION public.spend_points_on_vote(p_request_id uuid, p_user_id uuid, p_points_to_spend integer, p_guest_session_id text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_balance INTEGER;
  v_vote_id UUID;
  v_request_event_id UUID;
  v_uid UUID := auth.uid();
  v_points INTEGER := GREATEST(COALESCE(p_points_to_spend, 0), 0);
BEGIN
  IF v_uid IS NULL THEN
    v_points := 0;
  END IF;

  IF v_points > 100000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  SELECT event_id INTO v_request_event_id FROM song_requests WHERE id = p_request_id;
  IF v_request_event_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_uid IS NOT NULL AND v_points > 0 THEN
    SELECT points_balance INTO v_current_balance FROM profiles WHERE user_id = v_uid FOR UPDATE;
    IF v_current_balance IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
    END IF;
    IF v_current_balance < v_points THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient points', 'balance', v_current_balance);
    END IF;

    UPDATE profiles SET points_balance = points_balance - v_points, updated_at = now() WHERE user_id = v_uid;

    INSERT INTO point_transactions (user_id, amount, transaction_type, description, reference_id)
    VALUES (v_uid, -v_points, 'spent', 'Vote on song request', p_request_id);
  END IF;

  INSERT INTO votes (request_id, user_id, guest_session_id, points_spent)
  VALUES (p_request_id, v_uid, p_guest_session_id, v_points)
  RETURNING id INTO v_vote_id;

  UPDATE song_requests
  SET vote_count = vote_count + GREATEST(v_points / 10, 1), updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'vote_id', v_vote_id,
    'points_spent', v_points,
    'new_balance', COALESCE((SELECT points_balance FROM profiles WHERE user_id = v_uid), 0)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_points_tip(p_from_user_id uuid, p_to_user_id uuid, p_event_id uuid, p_amount_cents integer, p_message text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_balance INTEGER;
  v_tip_id UUID;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be signed in to tip');
  END IF;
  IF p_to_user_id IS NULL OR p_to_user_id = v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid tip recipient');
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 OR p_amount_cents > 1000000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid tip amount');
  END IF;
  IF p_message IS NOT NULL AND char_length(p_message) > 300 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Message too long');
  END IF;

  SELECT points_balance INTO v_current_balance FROM profiles WHERE user_id = v_uid FOR UPDATE;
  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;
  IF v_current_balance < p_amount_cents THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient points', 'balance', v_current_balance);
  END IF;

  UPDATE profiles SET points_balance = points_balance - p_amount_cents, updated_at = now() WHERE user_id = v_uid;

  INSERT INTO tips (from_user_id, to_user_id, event_id, amount_cents, tip_type, message)
  VALUES (v_uid, p_to_user_id, p_event_id, p_amount_cents, 'points', p_message)
  RETURNING id INTO v_tip_id;

  INSERT INTO point_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (v_uid, -p_amount_cents, 'spent', 'Tip sent', v_tip_id);

  RETURN jsonb_build_object(
    'success', true,
    'tip_id', v_tip_id,
    'points_spent', p_amount_cents,
    'new_balance', (SELECT points_balance FROM profiles WHERE user_id = v_uid)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.purchase_ticket(p_ticket_id uuid, p_user_id uuid, p_quantity integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket record;
  v_total integer;
  v_balance integer;
  v_purchase_id uuid;
  v_uid uuid := auth.uid();
  v_qty integer := COALESCE(p_quantity, 1);
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be signed in to buy tickets');
  END IF;
  IF v_qty < 1 OR v_qty > 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid quantity');
  END IF;

  SELECT * INTO v_ticket FROM event_tickets WHERE id = p_ticket_id AND is_active = true FOR UPDATE;
  IF v_ticket IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found or inactive');
  END IF;
  IF v_ticket.quantity_sold + v_qty > v_ticket.quantity_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not enough tickets available');
  END IF;

  v_total := v_ticket.price_cents * v_qty;

  SELECT points_balance INTO v_balance FROM profiles WHERE user_id = v_uid FOR UPDATE;
  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;
  IF v_balance < v_total THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient points', 'balance', v_balance);
  END IF;

  UPDATE profiles SET points_balance = points_balance - v_total, updated_at = now() WHERE user_id = v_uid;
  UPDATE event_tickets SET quantity_sold = quantity_sold + v_qty, updated_at = now() WHERE id = p_ticket_id;

  INSERT INTO ticket_purchases (ticket_id, event_id, user_id, quantity, total_cents)
  VALUES (p_ticket_id, v_ticket.event_id, v_uid, v_qty, v_total)
  RETURNING id INTO v_purchase_id;

  INSERT INTO point_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (v_uid, -v_total, 'spent', 'Ticket purchase: ' || v_ticket.name, v_purchase_id);

  RETURN jsonb_build_object('success', true, 'purchase_id', v_purchase_id, 'total', v_total, 'new_balance', (SELECT points_balance FROM profiles WHERE user_id = v_uid));
END;
$function$;

-- 4. Atomic server-side drink ordering
CREATE OR REPLACE FUNCTION public.place_table_order(p_table_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_event_id uuid;
  v_total integer := 0;
  v_balance integer;
  v_item jsonb;
  v_menu record;
  v_qty integer;
  v_discount integer;
  v_price integer;
  v_desc text := '';
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be signed in to order');
  END IF;

  SELECT event_id INTO v_event_id
  FROM guest_tables
  WHERE id = p_table_id AND user_id = v_uid AND status = 'open';
  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Table not found or not yours');
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No items in order');
  END IF;
  IF jsonb_array_length(p_items) > 50 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too many items');
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _order_lines (
    menu_item_id uuid, item_name text, item_emoji text, quantity integer, price_cents integer
  ) ON COMMIT DROP;
  DELETE FROM _order_lines;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    IF v_qty < 1 OR v_qty > 50 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid item quantity');
    END IF;

    SELECT * INTO v_menu
    FROM venue_menu_items
    WHERE id = (v_item->>'menu_item_id')::uuid AND is_active = true;
    IF v_menu IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Menu item unavailable');
    END IF;

    -- best active announcement discount for this category
    SELECT COALESCE(MAX(a.discount_percent), 0) INTO v_discount
    FROM event_announcements a
    WHERE a.event_id = v_event_id
      AND a.is_active = true
      AND a.discount_percent IS NOT NULL
      AND (a.expires_at IS NULL OR a.expires_at > now())
      AND (a.discount_categories IS NULL OR array_length(a.discount_categories, 1) IS NULL
           OR v_menu.category = ANY(a.discount_categories));

    v_discount := LEAST(GREATEST(COALESCE(v_discount, 0), 0), 100);
    v_price := ROUND(v_menu.price_cents * (1 - v_discount::numeric / 100));
    v_total := v_total + v_price * v_qty;
    v_desc := v_desc || CASE WHEN v_desc = '' THEN '' ELSE ', ' END || v_qty || 'x ' || v_menu.emoji || ' ' || v_menu.name;

    INSERT INTO _order_lines VALUES (v_menu.id, v_menu.name, v_menu.emoji, v_qty, v_price);
  END LOOP;

  SELECT points_balance INTO v_balance FROM profiles WHERE user_id = v_uid FOR UPDATE;
  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;
  IF v_balance < v_total THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient points', 'balance', v_balance);
  END IF;

  UPDATE profiles SET points_balance = points_balance - v_total, updated_at = now() WHERE user_id = v_uid;

  INSERT INTO table_orders (table_id, menu_item_id, quantity, price_cents, item_name, item_emoji)
  SELECT p_table_id, menu_item_id, quantity, price_cents, item_name, item_emoji FROM _order_lines;

  INSERT INTO point_transactions (user_id, amount, transaction_type, description)
  VALUES (v_uid, -v_total, 'spent', 'Table order: ' || v_desc);

  RETURN jsonb_build_object('success', true, 'total', v_total, 'new_balance', (SELECT points_balance FROM profiles WHERE user_id = v_uid));
END;
$function$;

-- 5. Rate-limited demo top-up
CREATE OR REPLACE FUNCTION public.grant_demo_points()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_last timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be signed in');
  END IF;

  SELECT MAX(created_at) INTO v_last
  FROM point_transactions
  WHERE user_id = v_uid AND description = 'Test points (demo mode)';

  IF v_last IS NOT NULL AND v_last > now() - interval '5 minutes' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Please wait a few minutes before topping up again');
  END IF;

  UPDATE profiles SET points_balance = points_balance + 1000, updated_at = now() WHERE user_id = v_uid;

  INSERT INTO point_transactions (user_id, amount, transaction_type, description)
  VALUES (v_uid, 1000, 'earned', 'Test points (demo mode)');

  RETURN jsonb_build_object('success', true, 'new_balance', (SELECT points_balance FROM profiles WHERE user_id = v_uid));
END;
$function$;

-- 6. Execute privileges
REVOKE ALL ON FUNCTION public.send_points_tip(uuid, uuid, uuid, integer, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.purchase_ticket(uuid, uuid, integer) FROM anon, public;
REVOKE ALL ON FUNCTION public.get_user_ticket_perks(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.seed_default_menu_items(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.grant_registration_bonus() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.protect_profile_balance() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.place_table_order(uuid, jsonb) FROM anon, public;
REVOKE ALL ON FUNCTION public.grant_demo_points() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.send_points_tip(uuid, uuid, uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purchase_ticket(uuid, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_ticket_perks(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.place_table_order(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.grant_demo_points() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spend_points_on_vote(uuid, uuid, integer, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_event_leaderboard(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO anon, authenticated, service_role;