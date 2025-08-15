/**
 * MCP Tool: Create Ad (uses existing creative_id)
 * - POST /act_<account_id>/ads
 */

const executeFunction = async ({
  // Routing
  account_id,               // REQUIRED: ad account id (no "act_" prefix)

  // Ad placement
  adset_id,                 // REQUIRED
  creative_id,              // REQUIRED (from create-ad-creative or elsewhere)

  // Ad meta
  ad_name = null,           // Default generated if not provided
  status = 'PAUSED'         // 'PAUSED' | 'ACTIVE' | 'ARCHIVED' | 'DELETED'
}) => {
  const { createClient } = await import('@supabase/supabase-js');

  // Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const API_VERSION = process.env.FACEBOOK_API_VERSION || 'v23.0';
  const baseUrl = `https://graph.facebook.com/${API_VERSION}`;

  // ----- Helpers -----
  const getUserFromAccount = async (supabaseClient, accountId) => {
    console.log('🔍 Finding user for account ID:', accountId);
    if (!accountId) throw new Error('Account ID is required');
    const accountIdStr = String(accountId).trim();
    const { data, error } = await supabaseClient
      .from('facebook_ad_accounts')
      .select('user_id, id, name')
      .eq('id', accountIdStr);
    if (error) throw new Error(`Account lookup failed: ${error.message}`);
    if (!data || data.length === 0) throw new Error(`Ad account ${accountIdStr} not found in database.`);
    const row = data[0];
    if (!row.user_id) throw new Error(`Account ${accountIdStr} found but has no associated user_id`);
    console.log('✅ Found user ID:', row.user_id, 'for account:', row.name);
    return row.user_id;
  };

  const getFacebookToken = async (supabaseClient, userId) => {
    console.log('🔑 Getting Facebook token for userId:', userId);
    const { data, error } = await supabaseClient
      .from('users')
      .select('facebook_long_lived_token')
      .eq('id', userId)
      .single();
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return data?.facebook_long_lived_token || null;
  };

  const clean = (obj) => {
    const o = { ...obj };
    Object.entries(o).forEach(([k, v]) => {
      if (v == null || (typeof v === 'string' && v.trim() === '')) delete o[k];
    });
    return o;
  };

  // ----- Validate inputs -----
  if (!account_id) return { error: 'Missing required parameter: account_id' };
  if (!adset_id) return { error: 'Missing required parameter: adset_id' };
  if (!creative_id) return { error: 'Missing required parameter: creative_id' };

  if (!ad_name) {
    const today = new Date().toISOString().split('T')[0];
    console.log('ℹ️ No ad_name supplied; generating a default name.');
    ad_name = `Ad ${today}`;
  }

  console.log('📥 Input parameters received:', { account_id, adset_id, creative_id, status });

  try {
    // 1) Token
    const userId = await getUserFromAccount(supabase, account_id);
    const token = await getFacebookToken(supabase, userId);
    if (!token) {
      return {
        error: 'No Facebook access token found for the user who owns this ad account',
        details: `Account ${account_id} belongs to user ${userId} but they have no Facebook token`
      };
    }

    // 2) Create ad
    const url = `${baseUrl}/act_${account_id}/ads`;
    const params = clean({
      name: ad_name,
      adset_id,
      status,
      creative: JSON.stringify({ creative_id }),
      access_token: token
    });
    const body = new URLSearchParams(params);

    console.log('🚀 Creating Ad at:', url);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    const json = await resp.json();
    if (!resp.ok || json?.error) {
      console.error('❌ Ad creation error:', json);
      return {
        error: `Ad creation failed: ${json?.error?.message || 'Unknown error'}`,
        details: json
      };
    }

    return {
      success: true,
      ad: {
        id: json?.id,
        name: ad_name,
        status,
        adset_id,
        creative_id
      }
    };
  } catch (error) {
    console.error('💥 Error in executeFunction (create-ad):', error);
    return {
      error: 'An error occurred while creating the ad.',
      details: error.message
    };
  }
};

/**
 * JSON Schema (single source of truth) for inputs
 * Reused for both MCP-native inputSchema and function.parameters
 */
const INPUT_SCHEMA = {
  type: 'object',
  properties: {
    account_id: { type: 'string', description: 'REQUIRED: Facebook ad account ID (no act_ prefix)' },
    adset_id: { type: 'string', description: 'REQUIRED: Target Ad Set ID' },
    creative_id: { type: 'string', description: 'REQUIRED: ID of the already-created Ad Creative' },
    ad_name: { type: 'string', description: 'Ad name (default auto-generated if omitted)' },
    status: {
      type: 'string',
      enum: ['PAUSED', 'ACTIVE', 'ARCHIVED', 'DELETED'],
      description: 'Initial ad status (default: PAUSED)'
    }
  },
  required: ['account_id', 'adset_id', 'creative_id']
};

/**
 * Tool configuration with MCP-native fields + back-compat
 */
const apiTool = {
  function: executeFunction,
  definition: {
    // ✅ MCP-native (what most clients expect)
    name: 'create-ad',
    description: 'Create a Facebook Ad referencing an existing creative_id.',
    inputSchema: INPUT_SCHEMA,

    // ♻️ Back-compat for function-style loaders
    type: 'function',
    function: {
      name: 'create-ad',
      description: 'Create a Facebook Ad referencing an existing creative_id.',
      parameters: INPUT_SCHEMA
    }
  }
};

export { apiTool };
