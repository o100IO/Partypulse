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