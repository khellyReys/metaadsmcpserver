/**
 * Shared token utilities for Facebook Marketing API tools.
 * Fetches facebook_long_lived_token from Supabase (users table).
 * Use userId when available, or derive from account_id via facebook_ad_accounts.
 */
import { createClient } from '@supabase/supabase-js';

let _fallbackToken = null;
export function setFallbackToken(token) { _fallbackToken = token; }
export function clearFallbackToken() { _fallbackToken = null; }

export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'Supabase server config missing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (do not use anon key for server-side tools).'
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getTokenForUser(supabase, userId) {
  if (!userId) throw new Error('userId is required');
  const { data, error } = await supabase
    .from('users')
    .select('facebook_long_lived_token')
    .eq('id', userId)
    .single();
  if (error) throw new Error(`Token lookup failed: ${error.message}`);
  return data?.facebook_long_lived_token || null;
}

export async function getTokenForAccount(supabase, accountId) {
  if (!accountId) throw new Error('account_id is required');
  const accountIdStr = String(accountId).trim().replace(/^act_/, '');
  const idsToTry = [`act_${accountIdStr}`, accountIdStr];
  for (const id of idsToTry) {
    const { data, error } = await supabase
      .from('facebook_ad_accounts')
      .select('user_id')
      .eq('id', id)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Account lookup failed: ${error.message}`);
    if (data?.user_id) {
      return getTokenForUser(supabase, data.user_id);
    }
  }
  if (_fallbackToken) return _fallbackToken;
  throw new Error(`Ad account ${accountId} not found in database`);
}
