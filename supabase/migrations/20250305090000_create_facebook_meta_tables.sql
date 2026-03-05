-- Create Facebook Meta tables required for ad account lookup and tool execution.
-- public.users must already exist (e.g. from Supabase Auth or your app).
-- These tables are altered by 20250305110000_add_cascade_deletes.sql.

-- facebook_business_accounts: Business Manager accounts linked to a user
CREATE TABLE IF NOT EXISTS public.facebook_business_accounts (
  id text PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- facebook_ad_accounts: Ad accounts (act_*) linked to user and optionally to a business
CREATE TABLE IF NOT EXISTS public.facebook_ad_accounts (
  id text PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  business_account_id text REFERENCES public.facebook_business_accounts(id) ON DELETE CASCADE,
  name text,
  account_status integer,
  currency text,
  timezone_name text,
  account_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- facebook_pages: Pages linked to a user (referenced by cascade migration)
CREATE TABLE IF NOT EXISTS public.facebook_pages (
  id text PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- facebook_token_logs: Optional logging for token usage (referenced by cascade migration)
CREATE TABLE IF NOT EXISTS public.facebook_token_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_facebook_ad_accounts_user_id ON public.facebook_ad_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_facebook_ad_accounts_business_account_id ON public.facebook_ad_accounts(business_account_id);
CREATE INDEX IF NOT EXISTS idx_facebook_business_accounts_user_id ON public.facebook_business_accounts(user_id);

COMMENT ON TABLE public.facebook_ad_accounts IS 'Maps ad account IDs (act_*) to users for token lookup in MCP tools';
COMMENT ON TABLE public.facebook_business_accounts IS 'Facebook Business Manager accounts linked to users';
COMMENT ON TABLE public.facebook_pages IS 'Facebook Pages linked to users';
COMMENT ON TABLE public.facebook_token_logs IS 'Optional log of token usage per user';
