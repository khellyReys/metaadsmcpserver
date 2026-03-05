-- Links Facebook user IDs to Supabase auth user IDs for custom OAuth (no email required).
-- Used by auth-facebook Edge Function.

CREATE TABLE IF NOT EXISTS public.fb_auth_links (
  facebook_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: no policies = anon gets no access; Edge Function uses service_role and bypasses RLS
ALTER TABLE public.fb_auth_links ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.fb_auth_links IS 'Maps Facebook user IDs to Supabase auth.users for email-optional login';
