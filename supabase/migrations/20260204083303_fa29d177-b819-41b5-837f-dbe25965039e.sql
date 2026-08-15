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