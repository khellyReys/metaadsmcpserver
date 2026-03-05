-- Server settings (jsonb): merge patch into servers.settings for current user.
-- Use for last_workspace (business_id, ad_account_id, page_id), tool_defaults, preferences.

CREATE OR REPLACE FUNCTION public.update_server_settings(
  p_server_id uuid,
  p_settings jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_server_id IS NULL OR p_settings IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.servers
  SET
    settings = COALESCE(settings, '{}'::jsonb) || p_settings,
    updated_at = now()
  WHERE id = p_server_id
    AND user_id = auth.uid();
END;
$$;

COMMENT ON FUNCTION public.update_server_settings(uuid, jsonb)
  IS 'Merges p_settings into server.settings for the current user (by server id).';

-- Get server settings for restore / "Continue with last setup".
CREATE OR REPLACE FUNCTION public.get_server_settings(p_server_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings jsonb;
BEGIN
  IF p_server_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;
  SELECT COALESCE(settings, '{}'::jsonb)
  INTO v_settings
  FROM public.servers
  WHERE id = p_server_id
    AND user_id = auth.uid();
  RETURN COALESCE(v_settings, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_server_settings(uuid)
  IS 'Returns server.settings for the current user (for last_workspace restore).';

-- Optional: set server description (e.g. when create_server_with_session does not accept p_description).
CREATE OR REPLACE FUNCTION public.update_server_description(
  p_server_id uuid,
  p_description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_server_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.servers
  SET
    description = NULLIF(TRIM(COALESCE(p_description, '')), ''),
    updated_at = now()
  WHERE id = p_server_id
    AND user_id = auth.uid();
END;
$$;

COMMENT ON FUNCTION public.update_server_description(uuid, text)
  IS 'Updates server description for the current user.';

-- Return user servers with settings (for "Continue with last setup" in UI).
-- Use this in place of get_user_servers when you need settings.
CREATE OR REPLACE FUNCTION public.get_user_servers_with_settings(p_user_id uuid)
RETURNS TABLE (
  server_id uuid,
  server_name text,
  session_token text,
  created_at timestamptz,
  is_active boolean,
  settings jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid() THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    s.id AS server_id,
    s.name AS server_name,
    m.session_token,
    s.created_at,
    COALESCE(s.is_active, true) AS is_active,
    COALESCE(s.settings, '{}'::jsonb) AS settings
  FROM public.servers s
  LEFT JOIN public.mcp_sessions m ON m.id = s.mcp_session_id
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_user_servers_with_settings(uuid)
  IS 'Returns user servers with settings for dashboard and Continue with last setup.';
