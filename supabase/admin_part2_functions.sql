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
