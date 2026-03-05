-- Returns the current user's Facebook token expiry for the dashboard to gate access.
-- Requires a table (e.g. public.users) with id = auth.uid() and facebook_token_expires_at.
-- If your table/column names differ, update the SELECT below.

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
