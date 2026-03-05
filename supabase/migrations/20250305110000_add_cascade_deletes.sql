-- Add ON DELETE CASCADE so that:
-- 1) When a user is deleted, all their related rows (servers, mcp_sessions, facebook_*, etc.) are removed.
-- 2) When a server is deleted, its mcp_sessions (and any other server-scoped rows) are removed.
--
-- Constraint names must match your actual DB; PostgreSQL default is {table}_{column}_fkey.

-- ========== Clean up orphaned rows first ==========
DELETE FROM public.facebook_ad_accounts
  WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.facebook_business_accounts
  WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.facebook_pages
  WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.facebook_token_logs
  WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.mcp_sessions
  WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.servers
  WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users);

DELETE FROM public.fb_auth_links
  WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users);

-- ========== References to public.users(id) ==========

-- facebook_ad_accounts
ALTER TABLE public.facebook_ad_accounts
  DROP CONSTRAINT IF EXISTS facebook_ad_accounts_user_id_fkey,
  ADD CONSTRAINT facebook_ad_accounts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- When a business account is deleted, delete its ad accounts
ALTER TABLE public.facebook_ad_accounts
  DROP CONSTRAINT IF EXISTS facebook_ad_accounts_business_account_id_fkey,
  ADD CONSTRAINT facebook_ad_accounts_business_account_id_fkey
    FOREIGN KEY (business_account_id) REFERENCES public.facebook_business_accounts(id) ON DELETE CASCADE;

-- facebook_business_accounts
ALTER TABLE public.facebook_business_accounts
  DROP CONSTRAINT IF EXISTS facebook_business_accounts_user_id_fkey,
  ADD CONSTRAINT facebook_business_accounts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- facebook_pages
ALTER TABLE public.facebook_pages
  DROP CONSTRAINT IF EXISTS facebook_pages_user_id_fkey,
  ADD CONSTRAINT facebook_pages_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- facebook_token_logs
ALTER TABLE public.facebook_token_logs
  DROP CONSTRAINT IF EXISTS facebook_token_logs_user_id_fkey,
  ADD CONSTRAINT facebook_token_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- mcp_sessions: delete when user is deleted
ALTER TABLE public.mcp_sessions
  DROP CONSTRAINT IF EXISTS mcp_sessions_user_id_fkey,
  ADD CONSTRAINT mcp_sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- mcp_sessions: delete when server is deleted (associated records for that server)
ALTER TABLE public.mcp_sessions
  DROP CONSTRAINT IF EXISTS mcp_sessions_server_id_fkey,
  ADD CONSTRAINT mcp_sessions_server_id_fkey
    FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE CASCADE;

-- servers: delete when user is deleted
ALTER TABLE public.servers
  DROP CONSTRAINT IF EXISTS servers_user_id_fkey,
  ADD CONSTRAINT servers_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- When an mcp_session is deleted (e.g. via server CASCADE), clear server's reference
ALTER TABLE public.servers
  DROP CONSTRAINT IF EXISTS servers_mcp_session_id_fkey,
  ADD CONSTRAINT servers_mcp_session_id_fkey
    FOREIGN KEY (mcp_session_id) REFERENCES public.mcp_sessions(id) ON DELETE SET NULL;

-- fb_auth_links: cascade from public.users (not auth.users)
ALTER TABLE public.fb_auth_links
  DROP CONSTRAINT IF EXISTS fb_auth_links_user_id_fkey,
  ADD CONSTRAINT fb_auth_links_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
