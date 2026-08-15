-- Bootstrap for aravfgeswpnnceujngmb — run once in SQL Editor

-- >>> 20260126103831_911f1c35-a7a1-4bb4-bf7a-751a10ab100c.sql
-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('venue_owner', 'dj', 'bartender', 'guest');

-- Create event_status enum
CREATE TYPE public.event_status AS ENUM ('draft', 'scheduled', 'live', 'ended', 'archived');

-- Create request_status enum
CREATE TYPE public.request_status AS ENUM ('pending', 'accepted', 'declined', 'playing', 'played');

-- Create tip_type enum
CREATE TYPE public.tip_type AS ENUM ('direct', 'points');

-- Create point_transaction_type enum
CREATE TYPE public.point_transaction_type AS ENUM ('purchase', 'earned', 'spent', 'refund');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  points_balance INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Create venues table
CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  logo_url TEXT,
  qr_code TEXT,
  settings JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create venue_staff table (links DJs and bartenders to venues)
CREATE TABLE public.venue_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL CHECK (role IN ('dj', 'bartender')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (venue_id, user_id)
);

-- Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  dj_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  genre TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  status event_status DEFAULT 'draft' NOT NULL,
  qr_code TEXT,
  settings JSONB DEFAULT '{"allow_pre_requests": true, "points_per_vote": 10}' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create song_requests table
CREATE TABLE public.song_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  guest_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_name TEXT,
  song_title TEXT NOT NULL,
  artist TEXT,
  source TEXT CHECK (source IN ('youtube', 'spotify')),
  source_id TEXT,
  thumbnail_url TEXT,
  shoutout_message TEXT,
  status request_status DEFAULT 'pending' NOT NULL,
  vote_count INTEGER DEFAULT 0 NOT NULL,
  is_pre_event BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create votes table
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.song_requests(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_session_id TEXT,
  points_spent INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create tips table
CREATE TABLE public.tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount_cents INTEGER NOT NULL,
  tip_type tip_type NOT NULL,
  message TEXT,
  stripe_payment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create point_transactions table
CREATE TABLE public.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  transaction_type point_transaction_type NOT NULL,
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'venue_owner' THEN 1 
      WHEN 'dj' THEN 2 
      WHEN 'bartender' THEN 3 
      WHEN 'guest' THEN 4 
    END
  LIMIT 1
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own initial role"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for venues
CREATE POLICY "Anyone can view venues"
  ON public.venues FOR SELECT
  USING (true);

CREATE POLICY "Venue owners can create venues"
  ON public.venues FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id AND public.has_role(auth.uid(), 'venue_owner'));

CREATE POLICY "Venue owners can update own venues"
  ON public.venues FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Venue owners can delete own venues"
  ON public.venues FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- RLS Policies for venue_staff
CREATE POLICY "Anyone can view venue staff"
  ON public.venue_staff FOR SELECT
  USING (true);

CREATE POLICY "Venue owners can manage staff"
  ON public.venue_staff FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.venues WHERE id = venue_id AND owner_id = auth.uid()));

CREATE POLICY "Venue owners can remove staff"
  ON public.venue_staff FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.venues WHERE id = venue_id AND owner_id = auth.uid()));

-- RLS Policies for events
CREATE POLICY "Anyone can view events"
  ON public.events FOR SELECT
  USING (true);

CREATE POLICY "DJs can create events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = dj_id AND public.has_role(auth.uid(), 'dj'));

CREATE POLICY "DJs can update own events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (auth.uid() = dj_id);

CREATE POLICY "DJs can delete own events"
  ON public.events FOR DELETE
  TO authenticated
  USING (auth.uid() = dj_id);

-- RLS Policies for song_requests
CREATE POLICY "Anyone can view requests for an event"
  ON public.song_requests FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create song requests"
  ON public.song_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "DJs can update requests for their events"
  ON public.song_requests FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND dj_id = auth.uid()));

CREATE POLICY "DJs can delete requests for their events"
  ON public.song_requests FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND dj_id = auth.uid()));

-- RLS Policies for votes
CREATE POLICY "Anyone can view votes"
  ON public.votes FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create votes"
  ON public.votes FOR INSERT
  WITH CHECK (true);

-- RLS Policies for tips
CREATE POLICY "Users can view tips they sent or received"
  ON public.tips FOR SELECT
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Anyone can create tips"
  ON public.tips FOR INSERT
  WITH CHECK (true);

-- RLS Policies for point_transactions
CREATE POLICY "Users can view own transactions"
  ON public.point_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can create transactions"
  ON public.point_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create trigger for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_song_requests_updated_at
  BEFORE UPDATE ON public.song_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for song_requests and votes
ALTER PUBLICATION supabase_realtime ADD TABLE public.song_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;

-- >>> 20260204083303_fa29d177-b819-41b5-837f-dbe25965039e.sql
-- Function to spend points on voting (atomic transaction)
CREATE OR REPLACE FUNCTION public.spend_points_on_vote(
  p_request_id UUID,
  p_user_id UUID,
  p_points_to_spend INTEGER,
  p_guest_session_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_balance INTEGER;
  v_vote_id UUID;
  v_request_event_id UUID;
BEGIN
  -- Get the event_id for the request
  SELECT event_id INTO v_request_event_id
  FROM song_requests
  WHERE id = p_request_id;

  IF v_request_event_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  -- If user is authenticated, check and deduct balance
  IF p_user_id IS NOT NULL AND p_points_to_spend > 0 THEN
    -- Get current balance with row lock
    SELECT points_balance INTO v_current_balance
    FROM profiles
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
    END IF;

    IF v_current_balance < p_points_to_spend THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient points', 'balance', v_current_balance);
    END IF;

    -- Deduct points
    UPDATE profiles
    SET points_balance = points_balance - p_points_to_spend,
        updated_at = now()
    WHERE user_id = p_user_id;

    -- Create point transaction record
    INSERT INTO point_transactions (user_id, amount, transaction_type, description, reference_id)
    VALUES (p_user_id, -p_points_to_spend, 'spent', 'Vote on song request', p_request_id);
  END IF;

  -- Create vote record
  INSERT INTO votes (request_id, user_id, guest_session_id, points_spent)
  VALUES (p_request_id, p_user_id, p_guest_session_id, p_points_to_spend)
  RETURNING id INTO v_vote_id;

  -- Update vote count on the request (add points as weight)
  UPDATE song_requests
  SET vote_count = vote_count + GREATEST(p_points_to_spend / 10, 1),
      updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'vote_id', v_vote_id,
    'points_spent', p_points_to_spend,
    'new_balance', COALESCE((SELECT points_balance FROM profiles WHERE user_id = p_user_id), 0)
  );
END;
$$;

-- Function to grant registration bonus
CREATE OR REPLACE FUNCTION public.grant_registration_bonus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only grant if this is a new profile (not an update)
  IF TG_OP = 'INSERT' THEN
    -- Award 100 points to new user
    UPDATE profiles
    SET points_balance = 100
    WHERE id = NEW.id;

    -- Create welcome bonus transaction
    INSERT INTO point_transactions (user_id, amount, transaction_type, description)
    VALUES (NEW.user_id, 100, 'earned', 'Welcome bonus for joining EventPulse');
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for registration bonus (drop if exists first)
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_registration_bonus();

-- >>> 20260218111154_fa03a315-5295-4fb2-9026-080c325e756d.sql

-- Create venue_menu_items table
CREATE TABLE public.venue_menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT NOT NULL DEFAULT 'ðŸ¹',
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
      (p_venue_id, 'Beer', 'ðŸº', 500, 'drinks', 1),
      (p_venue_id, 'Cocktail', 'ðŸ¸', 1200, 'drinks', 2),
      (p_venue_id, 'Shot', 'ðŸ¥ƒ', 800, 'drinks', 3),
      (p_venue_id, 'Bottle Service', 'ðŸ¾', 15000, 'bottles', 4),
      (p_venue_id, 'Water', 'ðŸ’§', 300, 'drinks', 5);
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


-- >>> 20260228063622_3474ce4c-119f-482f-b750-cfd60e57ab43.sql

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
  item_emoji text NOT NULL DEFAULT 'ðŸ¹',
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
      (p_venue_id, 'Heineken', 'ðŸº', 500, 'beers', 1),
      (p_venue_id, 'Corona', 'ðŸº', 500, 'beers', 2),
      (p_venue_id, 'Bud Light', 'ðŸº', 400, 'beers', 3),
      (p_venue_id, 'Guinness', 'ðŸº', 600, 'beers', 4),
      -- Cocktails
      (p_venue_id, 'Margarita', 'ðŸ¹', 1000, 'cocktails', 5),
      (p_venue_id, 'Mojito', 'ðŸ¹', 1000, 'cocktails', 6),
      (p_venue_id, 'Long Island', 'ðŸ¹', 1200, 'cocktails', 7),
      (p_venue_id, 'Cosmopolitan', 'ðŸ¸', 1100, 'cocktails', 8),
      -- Mixed Drinks
      (p_venue_id, 'Jack & Coke', 'ðŸ¥ƒ', 900, 'mixed', 9),
      (p_venue_id, 'Vodka Soda', 'ðŸ¸', 800, 'mixed', 10),
      (p_venue_id, 'Rum & Coke', 'ðŸ¥ƒ', 800, 'mixed', 11),
      (p_venue_id, 'Gin & Tonic', 'ðŸ¸', 800, 'mixed', 12),
      -- Shots
      (p_venue_id, 'Tequila Shot', 'ðŸ¥ƒ', 800, 'shots', 13),
      (p_venue_id, 'Fireball', 'ðŸ”¥', 700, 'shots', 14),
      (p_venue_id, 'Jello Shot', 'ðŸ¬', 500, 'shots', 15),
      (p_venue_id, 'JÃ¤germeister', 'ðŸ¦Œ', 800, 'shots', 16),
      -- Bottles
      (p_venue_id, 'Grey Goose', 'ðŸ¾', 20000, 'bottles', 17),
      (p_venue_id, 'Hennessy', 'ðŸ¥ƒ', 25000, 'bottles', 18),
      (p_venue_id, 'Don Julio', 'ðŸŒµ', 30000, 'bottles', 19),
      (p_venue_id, 'MoÃ«t & Chandon', 'ðŸ¥‚', 35000, 'bottles', 20),
      (p_venue_id, 'Ace of Spades', 'â™ ï¸', 50000, 'bottles', 21),
      -- Non-Alcoholic
      (p_venue_id, 'Water', 'ðŸ’§', 300, 'non-alcoholic', 22),
      (p_venue_id, 'Red Bull', 'ðŸ‚', 500, 'non-alcoholic', 23),
      (p_venue_id, 'Soda', 'ðŸ¥¤', 300, 'non-alcoholic', 24);
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


-- >>> 20260302195804_80a51272-6d47-4b3f-9deb-3a6c47b45fc3.sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_tables;

-- >>> 20260308204008_83c894bd-4370-48ce-a7a1-829ffa1448de.sql

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


-- >>> 20260308205609_5d2919f7-8af0-4352-8e78-8a66cae831e2.sql

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


-- >>> 20260309073220_cc8474dd-cb01-4d87-9489-9c80cc82675f.sql
-- Venue owners can update (pin) chat messages for events at their venue
CREATE POLICY "Venue owners can update chat messages"
ON public.event_chat_messages FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM events e
  JOIN venues v ON v.id = e.venue_id
  WHERE e.id = event_chat_messages.event_id
  AND v.owner_id = auth.uid()
));

-- Venue owners can delete chat messages for events at their venue
CREATE POLICY "Venue owners can delete chat messages"
ON public.event_chat_messages FOR DELETE
USING (EXISTS (
  SELECT 1 FROM events e
  JOIN venues v ON v.id = e.venue_id
  WHERE e.id = event_chat_messages.event_id
  AND v.owner_id = auth.uid()
));

-- >>> 20260803004343_76db4926-3a0f-42f2-a8d7-561faa513445.sql
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

-- >>> 20260815200000_join_policy_and_sandbox_fixes.sql
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


-- >>> 20260815210000_admin_role_enum.sql
-- Must be its own migration/transaction before using 'admin' in SQL
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';


-- >>> 20260815210001_admin_role_functions.sql
-- Platform admin helpers + policies (requires admin enum from prior migration)

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(p_display_name text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not signed in');
  END IF;

  IF public.admin_exists() THEN
    RETURN jsonb_build_object('success', false, 'error', 'An admin already exists');
  END IF;

  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (
    v_uid,
    (SELECT email FROM auth.users WHERE id = v_uid),
    COALESCE(NULLIF(trim(p_display_name), ''), split_part((SELECT email FROM auth.users WHERE id = v_uid), '@', 1))
  )
  ON CONFLICT (user_id) DO UPDATE
    SET display_name = COALESCE(NULLIF(trim(p_display_name), ''), public.profiles.display_name),
        updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin(text) TO authenticated;

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage venues" ON public.venues;
CREATE POLICY "Admins can manage venues"
  ON public.venues FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
CREATE POLICY "Admins can manage events"
  ON public.events FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all song requests" ON public.song_requests;
CREATE POLICY "Admins can view all song requests"
  ON public.song_requests FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all tips" ON public.tips;
CREATE POLICY "Admins can view all tips"
  ON public.tips FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all point transactions" ON public.point_transactions;
CREATE POLICY "Admins can view all point transactions"
  ON public.point_transactions FOR SELECT TO authenticated
  USING (public.is_admin() OR auth.uid() = user_id);

