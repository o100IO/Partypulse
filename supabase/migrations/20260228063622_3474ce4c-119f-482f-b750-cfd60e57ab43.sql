
-- 1. event_tickets table
CREATE TABLE public.event_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  quantity_available integer NOT NULL DEFAULT 100,
  quantity_sold integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active tickets" ON public.event_tickets FOR SELECT USING (is_active = true);
CREATE POLICY "DJs can insert tickets" ON public.event_tickets FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM events WHERE events.id = event_tickets.event_id AND events.dj_id = auth.uid()));
CREATE POLICY "DJs can update tickets" ON public.event_tickets FOR UPDATE USING (EXISTS (SELECT 1 FROM events WHERE events.id = event_tickets.event_id AND events.dj_id = auth.uid()));
CREATE POLICY "DJs can delete tickets" ON public.event_tickets FOR DELETE USING (EXISTS (SELECT 1 FROM events WHERE events.id = event_tickets.event_id AND events.dj_id = auth.uid()));

-- 2. ticket_purchases table
CREATE TABLE public.ticket_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.event_tickets(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  total_cents integer NOT NULL DEFAULT 0,
  purchased_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases" ON public.ticket_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can insert purchases" ON public.ticket_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. guest_tables table
CREATE TABLE public.guest_tables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  table_name text NOT NULL DEFAULT 'My Table',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.guest_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tables" ON public.guest_tables FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM events WHERE events.id = guest_tables.event_id AND events.dj_id = auth.uid()));
CREATE POLICY "Users can create own tables" ON public.guest_tables FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tables" ON public.guest_tables FOR UPDATE USING (auth.uid() = user_id);

-- 4. table_orders table
CREATE TABLE public.table_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id uuid NOT NULL REFERENCES public.guest_tables(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.venue_menu_items(id),
  quantity integer NOT NULL DEFAULT 1,
  price_cents integer NOT NULL DEFAULT 0,
  item_name text NOT NULL,
  item_emoji text NOT NULL DEFAULT '🍹',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.table_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own table orders" ON public.table_orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM guest_tables WHERE guest_tables.id = table_orders.table_id AND (guest_tables.user_id = auth.uid() OR EXISTS (SELECT 1 FROM events WHERE events.id = guest_tables.event_id AND events.dj_id = auth.uid())))
);
CREATE POLICY "Users can insert own table orders" ON public.table_orders FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM guest_tables WHERE guest_tables.id = table_orders.table_id AND guest_tables.user_id = auth.uid())
);
CREATE POLICY "DJs can update order status" ON public.table_orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM guest_tables gt JOIN events e ON e.id = gt.event_id WHERE gt.id = table_orders.table_id AND e.dj_id = auth.uid())
);

-- 5. purchase_ticket function
CREATE OR REPLACE FUNCTION public.purchase_ticket(p_ticket_id uuid, p_user_id uuid, p_quantity integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ticket record;
  v_total integer;
  v_balance integer;
  v_purchase_id uuid;
BEGIN
  SELECT * INTO v_ticket FROM event_tickets WHERE id = p_ticket_id AND is_active = true FOR UPDATE;
  IF v_ticket IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found or inactive');
  END IF;

  IF v_ticket.quantity_sold + p_quantity > v_ticket.quantity_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not enough tickets available');
  END IF;

  v_total := v_ticket.price_cents * p_quantity;

  SELECT points_balance INTO v_balance FROM profiles WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;
  IF v_balance < v_total THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient points', 'balance', v_balance);
  END IF;

  UPDATE profiles SET points_balance = points_balance - v_total, updated_at = now() WHERE user_id = p_user_id;
  UPDATE event_tickets SET quantity_sold = quantity_sold + p_quantity, updated_at = now() WHERE id = p_ticket_id;

  INSERT INTO ticket_purchases (ticket_id, event_id, user_id, quantity, total_cents)
  VALUES (p_ticket_id, v_ticket.event_id, p_user_id, p_quantity, v_total)
  RETURNING id INTO v_purchase_id;

  INSERT INTO point_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (p_user_id, -v_total, 'spent', 'Ticket purchase: ' || v_ticket.name, v_purchase_id);

  RETURN jsonb_build_object('success', true, 'purchase_id', v_purchase_id, 'total', v_total, 'new_balance', (SELECT points_balance FROM profiles WHERE user_id = p_user_id));
END;
$$;

-- 6. Update seed_default_menu_items with famous brands
CREATE OR REPLACE FUNCTION public.seed_default_menu_items(p_venue_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM venue_menu_items WHERE venue_id = p_venue_id) THEN
    INSERT INTO venue_menu_items (venue_id, name, emoji, price_cents, category, sort_order) VALUES
      -- Beers
      (p_venue_id, 'Heineken', '🍺', 500, 'beers', 1),
      (p_venue_id, 'Corona', '🍺', 500, 'beers', 2),
      (p_venue_id, 'Bud Light', '🍺', 400, 'beers', 3),
      (p_venue_id, 'Guinness', '🍺', 600, 'beers', 4),
      -- Cocktails
      (p_venue_id, 'Margarita', '🍹', 1000, 'cocktails', 5),
      (p_venue_id, 'Mojito', '🍹', 1000, 'cocktails', 6),
      (p_venue_id, 'Long Island', '🍹', 1200, 'cocktails', 7),
      (p_venue_id, 'Cosmopolitan', '🍸', 1100, 'cocktails', 8),
      -- Mixed Drinks
      (p_venue_id, 'Jack & Coke', '🥃', 900, 'mixed', 9),
      (p_venue_id, 'Vodka Soda', '🍸', 800, 'mixed', 10),
      (p_venue_id, 'Rum & Coke', '🥃', 800, 'mixed', 11),
      (p_venue_id, 'Gin & Tonic', '🍸', 800, 'mixed', 12),
      -- Shots
      (p_venue_id, 'Tequila Shot', '🥃', 800, 'shots', 13),
      (p_venue_id, 'Fireball', '🔥', 700, 'shots', 14),
      (p_venue_id, 'Jello Shot', '🍬', 500, 'shots', 15),
      (p_venue_id, 'Jägermeister', '🦌', 800, 'shots', 16),
      -- Bottles
      (p_venue_id, 'Grey Goose', '🍾', 20000, 'bottles', 17),
      (p_venue_id, 'Hennessy', '🥃', 25000, 'bottles', 18),
      (p_venue_id, 'Don Julio', '🌵', 30000, 'bottles', 19),
      (p_venue_id, 'Moët & Chandon', '🥂', 35000, 'bottles', 20),
      (p_venue_id, 'Ace of Spades', '♠️', 50000, 'bottles', 21),
      -- Non-Alcoholic
      (p_venue_id, 'Water', '💧', 300, 'non-alcoholic', 22),
      (p_venue_id, 'Red Bull', '🐂', 500, 'non-alcoholic', 23),
      (p_venue_id, 'Soda', '🥤', 300, 'non-alcoholic', 24);
  END IF;
END;
$$;

-- Add DJs can also manage menu items for their events
CREATE POLICY "DJs can insert event menu items" ON public.venue_menu_items FOR INSERT WITH CHECK (
  event_id IS NOT NULL AND EXISTS (SELECT 1 FROM events WHERE events.id = venue_menu_items.event_id AND events.dj_id = auth.uid())
);
CREATE POLICY "DJs can update event menu items" ON public.venue_menu_items FOR UPDATE USING (
  event_id IS NOT NULL AND EXISTS (SELECT 1 FROM events WHERE events.id = venue_menu_items.event_id AND events.dj_id = auth.uid())
);
CREATE POLICY "DJs can delete event menu items" ON public.venue_menu_items FOR DELETE USING (
  event_id IS NOT NULL AND EXISTS (SELECT 1 FROM events WHERE events.id = venue_menu_items.event_id AND events.dj_id = auth.uid())
);
