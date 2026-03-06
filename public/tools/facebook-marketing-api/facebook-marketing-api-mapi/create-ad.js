/**
 * MCP Tool: Create Ad (uses existing creative_id)
 * - POST /act_<account_id>/ads
 */

import { getBaseUrl, resolveToken, clean } from './_shared-helpers.js';

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
  const baseUrl = getBaseUrl();

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
    const { token } = await resolveToken(account_id);

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
    name: 'create_ad',
    description: 'Create a Facebook Ad that references an existing ad creative by its creative_id. Associates the creative with an ad set and configures the ad name and status. Use create_ad_creative or create_ad_with_creative to build the creative first. Returns the created ad ID. The account_id is auto-filled from server workspace if not provided.',
    inputSchema: INPUT_SCHEMA,

    // ♻️ Back-compat for function-style loaders
    type: 'function',
    function: {
      name: 'create_ad',
      description: 'Create a Facebook Ad that references an existing ad creative by its creative_id. Associates the creative with an ad set and configures the ad name and status. Use create_ad_creative or create_ad_with_creative to build the creative first. Returns the created ad ID. The account_id is auto-filled from server workspace if not provided.',
      parameters: INPUT_SCHEMA
    }
  }
};

export { apiTool };
