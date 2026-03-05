-- Returns the current user's Facebook token expiry for the dashboard to gate access.
-- Ensures public.users has the required columns, then creates the RPC.
-- public.users must already exist (e.g. from Supabase Auth or your app setup).

-- Ensure required columns exist so the RPC can read them
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'facebook_token_expires_at') THEN
    ALTER TABLE public.users ADD COLUMN facebook_token_expires_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'facebook_long_lived_token') THEN
    ALTER TABLE public.users ADD COLUMN facebook_long_lived_token text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'facebook_access_token') THEN
    ALTER TABLE public.users ADD COLUMN facebook_access_token text;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION get_my_facebook_token_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expires_at timestamptz;
  v_has_token boolean;
  v_token_value text;
BEGIN
  SELECT facebook_token_expires_at,
         COALESCE(facebook_long_lived_token, facebook_access_token)
  INTO v_expires_at, v_token_value
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;

  v_has_token := (v_expires_at IS NOT NULL AND v_token_value IS NOT NULL AND v_token_value != '');

  RETURN jsonb_build_object(
    'expires_at', to_char(v_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'has_token', v_has_token
  );
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    -- Table or column may not exist in all environments; return safe default
    RETURN jsonb_build_object('expires_at', NULL, 'has_token', false);
END;
$$;
