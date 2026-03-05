-- Add delete_server RPC for removing user-created MCP servers.
-- If you get "relation does not exist", check your Supabase Table Editor for the actual
-- server table name (e.g. servers, user_servers) and replace "servers" below.

CREATE OR REPLACE FUNCTION delete_server(p_server_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM servers
  WHERE id = p_server_id
    AND user_id = auth.uid();
END;
$$;
