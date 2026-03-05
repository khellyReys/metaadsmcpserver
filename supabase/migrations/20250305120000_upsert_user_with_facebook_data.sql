-- RPC used by the dashboard to save/update Facebook user and token data.
-- Only touches columns that already exist in public.users.
-- Non-essential columns (facebook_picture_url, facebook_email, facebook_name, name) are
-- written only if they exist; the function won't fail if they're missing.

-- Ensure the critical token columns exist (these are required by MCP tools)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'facebook_id') THEN
    ALTER TABLE public.users ADD COLUMN facebook_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'facebook_access_token') THEN
    ALTER TABLE public.users ADD COLUMN facebook_access_token text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'facebook_long_lived_token') THEN
    ALTER TABLE public.users ADD COLUMN facebook_long_lived_token text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'facebook_token_expires_at') THEN
    ALTER TABLE public.users ADD COLUMN facebook_token_expires_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'facebook_scopes') THEN
    ALTER TABLE public.users ADD COLUMN facebook_scopes text[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'facebook_picture_url') THEN
    ALTER TABLE public.users ADD COLUMN facebook_picture_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'facebook_name') THEN
    ALTER TABLE public.users ADD COLUMN facebook_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'facebook_email') THEN
    ALTER TABLE public.users ADD COLUMN facebook_email text;
  END IF;
END $$;

-- Drop ALL possible overloads so the name is unique
DROP FUNCTION IF EXISTS public.upsert_user_with_facebook_data(uuid, text, text, text, text, text, text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.upsert_user_with_facebook_data(uuid, text, text, text, text, text, text, text, text, text, text[]);
DROP FUNCTION IF EXISTS public.upsert_user_with_facebook_data(uuid, text, text, text, text, text, text, text, text, timestamptz, jsonb);
DROP FUNCTION IF EXISTS public.upsert_user_with_facebook_data(uuid, text, text, text, text, text, text, text, text, timestamptz, text[]);

CREATE OR REPLACE FUNCTION public.upsert_user_with_facebook_data(
  p_user_id uuid,
  p_email text DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_facebook_id text DEFAULT NULL,
  p_facebook_name text DEFAULT NULL,
  p_facebook_email text DEFAULT NULL,
  p_facebook_picture_url text DEFAULT NULL,
  p_facebook_access_token text DEFAULT NULL,
  p_facebook_long_lived_token text DEFAULT NULL,
  p_facebook_token_expires_at text DEFAULT NULL,
  p_facebook_scopes jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expires timestamptz;
  v_scopes  text[];
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot update another user';
  END IF;

  v_expires := (NULLIF(TRIM(COALESCE(p_facebook_token_expires_at, '')), ''))::timestamptz;

  IF p_facebook_scopes IS NOT NULL AND jsonb_typeof(p_facebook_scopes) = 'array' THEN
    SELECT array_agg(elem::text)
    INTO v_scopes
    FROM jsonb_array_elements_text(p_facebook_scopes) AS elem;
  END IF;

  INSERT INTO public.users (
    id,
    facebook_id,
    facebook_name,
    facebook_email,
    facebook_picture_url,
    facebook_access_token,
    facebook_long_lived_token,
    facebook_token_expires_at,
    facebook_scopes
  )
  VALUES (
    p_user_id,
    NULLIF(TRIM(p_facebook_id), ''),
    NULLIF(TRIM(p_facebook_name), ''),
    NULLIF(TRIM(p_facebook_email), ''),
    NULLIF(TRIM(p_facebook_picture_url), ''),
    NULLIF(TRIM(p_facebook_access_token), ''),
    NULLIF(TRIM(p_facebook_long_lived_token), ''),
    v_expires,
    v_scopes
  )
  ON CONFLICT (id) DO UPDATE SET
    facebook_id = COALESCE(NULLIF(TRIM(EXCLUDED.facebook_id), ''), users.facebook_id),
    facebook_name = COALESCE(NULLIF(TRIM(EXCLUDED.facebook_name), ''), users.facebook_name),
    facebook_email = COALESCE(NULLIF(TRIM(EXCLUDED.facebook_email), ''), users.facebook_email),
    facebook_picture_url = COALESCE(NULLIF(TRIM(EXCLUDED.facebook_picture_url), ''), users.facebook_picture_url),
    facebook_access_token = COALESCE(NULLIF(TRIM(EXCLUDED.facebook_access_token), ''), users.facebook_access_token),
    facebook_long_lived_token = COALESCE(NULLIF(TRIM(EXCLUDED.facebook_long_lived_token), ''), users.facebook_long_lived_token),
    facebook_token_expires_at = COALESCE(EXCLUDED.facebook_token_expires_at, users.facebook_token_expires_at),
    facebook_scopes = COALESCE(EXCLUDED.facebook_scopes, users.facebook_scopes);

  -- Update optional columns (email, name) only if they exist
  BEGIN
    EXECUTE format(
      'UPDATE public.users SET email = COALESCE($1, email), name = COALESCE($2, name) WHERE id = $3'
    ) USING NULLIF(TRIM(p_email), ''), NULLIF(TRIM(p_name), ''), p_user_id;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;
END;
$$;

COMMENT ON FUNCTION public.upsert_user_with_facebook_data(uuid, text, text, text, text, text, text, text, text, text, jsonb)
  IS 'Upserts Facebook profile and token for the current user (id = auth.uid())';
