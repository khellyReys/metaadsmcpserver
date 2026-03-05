-- Include server description in get_user_servers_with_settings for UI tooltip.
CREATE OR REPLACE FUNCTION public.get_user_servers_with_settings(p_user_id uuid)
RETURNS TABLE (
  server_id uuid,
  server_name text,
  session_token text,
  created_at timestamptz,
  is_active boolean,
  settings jsonb,
  description text
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
    COALESCE(s.settings, '{}'::jsonb) AS settings,
    s.description
  FROM public.servers s
  LEFT JOIN public.mcp_sessions m ON m.id = s.mcp_session_id
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_user_servers_with_settings(uuid)
  IS 'Returns user servers with settings and description for dashboard and Continue with last setup.';
