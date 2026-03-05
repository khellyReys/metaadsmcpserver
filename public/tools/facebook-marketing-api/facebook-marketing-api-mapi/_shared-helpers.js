/**
 * Shared helpers for Facebook Marketing API tools.
 * Centralizes auth, targeting, budget conversion, and error handling
 * to eliminate duplication across tool files.
 */
import { getSupabaseClient } from './_token-utils.js';

// ---- API Base URL ----

export function getBaseUrl() {
  const version = process.env.FACEBOOK_API_VERSION || 'v22.0';
  return `https://graph.facebook.com/${version}`;
}

// ---- Account ID normalization ----

export function normalizeAccountId(id) {
  if (!id) return id;
  return String(id).trim().replace(/^act_/, '');
}

// ---- Auth helpers ----

export async function getUserFromAccount(supabase, accountId) {
  if (!accountId) throw new Error('Account ID is required');
  const accountIdStr = String(accountId).trim();

  const { data, error } = await supabase
    .from('facebook_ad_accounts')
    .select('user_id, id, name')
    .eq('id', accountIdStr);

  if (error) throw new Error(`Account lookup failed: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(`Ad account ${accountIdStr} not found in database.`);
  }

  const row = data[0];
  if (!row.user_id) {
    throw new Error(`Account ${accountIdStr} found but has no associated user_id`);
  }
  return row.user_id;
}

export async function getFacebookToken(supabase, userId) {
  if (!userId) throw new Error('User ID is required');

  const { data, error } = await supabase
    .from('users')
    .select('facebook_long_lived_token')
    .eq('id', userId)
    .single();

  if (error) throw new Error(`Token lookup failed: ${error.message}`);
  if (!data || !data.facebook_long_lived_token) return null;
  return data.facebook_long_lived_token;
}

/**
 * One-call convenience: creates supabase client, resolves account -> user -> token.
 * Returns { supabase, userId, token }.
 */
export async function resolveToken(account_id) {
  const supabase = getSupabaseClient();
  const userId = await getUserFromAccount(supabase, account_id);
  const token = await getFacebookToken(supabase, userId);
  if (!token) {
    throw new Error(
      `No Facebook access token found. Account ${account_id} belongs to user ${userId} but they have no token.`
    );
  }
  return { supabase, userId, token };
}

// ---- Campaign info lookup ----

export async function getCampaignInfo(campaignId, token) {
  const url = new URL(`${getBaseUrl()}/${campaignId}`);
  url.searchParams.append('fields', 'objective,daily_budget,lifetime_budget');
  url.searchParams.append('access_token', token);
  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.error) {
    throw new Error(`Campaign lookup failed: ${data.error.message}`);
  }

  return {
    objective: data.objective,
    cboEnabled: !!(data.daily_budget || data.lifetime_budget),
  };
}

// ---- Object cleanup ----

export function clean(obj) {
  const o = { ...obj };
  for (const [k, v] of Object.entries(o)) {
    if (v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)) {
      delete o[k];
    }
  }
  return o;
}

// ---- Error helpers ----

export function safeFacebookError(errorData) {
  if (typeof errorData === 'string') return errorData;
  try {
    return JSON.stringify(errorData, null, 2);
  } catch {
    return String(errorData);
  }
}

// ---- Budget conversion ----

export function convertPesosToCents(pesos) {
  if (!pesos || pesos <= 0) return null;
  return Math.round(pesos * 100);
}

// ---- Location map ----

export const locationMap = {
  // Asia Pacific
  'PH': ['PH'], 'SG': ['SG'], 'MY': ['MY'], 'TH': ['TH'], 'VN': ['VN'],
  'ID': ['ID'], 'IN': ['IN'], 'JP': ['JP'], 'KR': ['KR'], 'CN': ['CN'],
  'HK': ['HK'], 'TW': ['TW'], 'AU': ['AU'], 'NZ': ['NZ'], 'BD': ['BD'],
  'LK': ['LK'], 'MM': ['MM'], 'KH': ['KH'], 'LA': ['LA'], 'BN': ['BN'],
  // Americas
  'US': ['US'], 'CA': ['CA'], 'MX': ['MX'], 'BR': ['BR'], 'AR': ['AR'],
  'CL': ['CL'], 'CO': ['CO'], 'PE': ['PE'], 'VE': ['VE'], 'EC': ['EC'],
  // Europe
  'GB': ['GB'], 'DE': ['DE'], 'FR': ['FR'], 'IT': ['IT'], 'ES': ['ES'],
  'NL': ['NL'], 'BE': ['BE'], 'CH': ['CH'], 'AT': ['AT'], 'SE': ['SE'],
  'NO': ['NO'], 'DK': ['DK'], 'FI': ['FI'], 'PL': ['PL'], 'RU': ['RU'],
  'UA': ['UA'], 'TR': ['TR'], 'GR': ['GR'], 'PT': ['PT'], 'IE': ['IE'],
  'CZ': ['CZ'], 'HU': ['HU'], 'RO': ['RO'], 'BG': ['BG'], 'HR': ['HR'],
  'SI': ['SI'], 'SK': ['SK'], 'LT': ['LT'], 'LV': ['LV'], 'EE': ['EE'],
  // Middle East & Africa
  'AE': ['AE'], 'SA': ['SA'], 'IL': ['IL'], 'EG': ['EG'], 'ZA': ['ZA'],
  'NG': ['NG'], 'KE': ['KE'], 'MA': ['MA'], 'GH': ['GH'], 'TN': ['TN'],
  'JO': ['JO'], 'LB': ['LB'], 'KW': ['KW'], 'QA': ['QA'], 'BH': ['BH'],
  'OM': ['OM'],
  // Regional Groups
  'ASEAN': ['PH', 'SG', 'MY', 'TH', 'VN', 'ID', 'MM', 'KH', 'LA', 'BN'],
  'SEA': ['PH', 'SG', 'MY', 'TH', 'VN', 'ID', 'MM', 'KH', 'LA', 'BN'],
  'APAC': ['PH', 'SG', 'MY', 'TH', 'VN', 'ID', 'IN', 'JP', 'KR', 'CN', 'HK', 'TW', 'AU', 'NZ'],
  'EU': ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'SE', 'DK', 'FI', 'PL', 'GR', 'PT', 'IE', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SI', 'SK', 'LT', 'LV', 'EE'],
  'EUROPE': ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'RU', 'UA', 'TR', 'GR', 'PT', 'IE', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SI', 'SK', 'LT', 'LV', 'EE'],
  'NORTH_AMERICA': ['US', 'CA'],
  'LATIN_AMERICA': ['MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC'],
  'MIDDLE_EAST': ['AE', 'SA', 'IL', 'JO', 'LB', 'KW', 'QA', 'BH', 'OM'],
  'GCC': ['AE', 'SA', 'KW', 'QA', 'BH', 'OM'],
  'ENGLISH_SPEAKING': ['US', 'GB', 'CA', 'AU', 'NZ', 'IE', 'SG', 'PH', 'IN', 'ZA'],
  'DEVELOPED_MARKETS': ['US', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'CA', 'AU', 'JP', 'KR', 'SG', 'HK'],
  'EMERGING_MARKETS': ['PH', 'MY', 'TH', 'VN', 'ID', 'IN', 'CN', 'BR', 'MX', 'AR', 'TR', 'RU', 'ZA'],
  'worldwide': null,
};

// ---- Gender map ----

export const genderMap = {
  'all': [1, 2],
  'male': [1],
  'female': [2],
};

// ---- Location enum for tool definitions ----

export const locationEnum = [
  'PH', 'SG', 'MY', 'TH', 'VN', 'ID', 'IN', 'JP', 'KR', 'CN', 'HK', 'TW', 'AU', 'NZ', 'BD', 'LK', 'MM', 'KH', 'LA', 'BN',
  'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC',
  'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'RU', 'UA', 'TR', 'GR', 'PT', 'IE', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SI', 'SK', 'LT', 'LV', 'EE',
  'AE', 'SA', 'IL', 'EG', 'ZA', 'NG', 'KE', 'MA', 'GH', 'TN', 'JO', 'LB', 'KW', 'QA', 'BH', 'OM',
  'ASEAN', 'SEA', 'APAC', 'EU', 'EUROPE', 'NORTH_AMERICA', 'LATIN_AMERICA', 'MIDDLE_EAST', 'GCC', 'ENGLISH_SPEAKING', 'DEVELOPED_MARKETS', 'EMERGING_MARKETS',
  'worldwide',
];

// ---- Targeting builder ----

export function buildTargeting({ location = 'PH', age_min = 18, age_max = 65, gender = 'all', custom_audience_id = null } = {}) {
  const targeting = { geo_locations: {} };

  if (location && locationMap[location]) {
    if (location !== 'worldwide') {
      targeting.geo_locations.countries = locationMap[location];
    }
  } else {
    targeting.geo_locations.countries = ['PH'];
  }

  if (age_min && age_min >= 13) targeting.age_min = age_min;
  if (age_max && age_max <= 65) targeting.age_max = age_max;

  if (gender && genderMap[gender]) {
    targeting.genders = genderMap[gender];
  }

  if (custom_audience_id) {
    targeting.custom_audiences = [{ id: custom_audience_id }];
  }

  return targeting;
}
