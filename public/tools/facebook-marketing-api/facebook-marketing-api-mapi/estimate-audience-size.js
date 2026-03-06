/**
 * Estimate audience size for targeting specifications using Meta's delivery_estimate API.
 */
import { getSupabaseClient, getTokenForAccount } from './_token-utils.js';
import { getBaseUrl, normalizeAccountId, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ account_id, targeting, optimization_goal = 'REACH', base_url }) => {
  const base = base_url || getBaseUrl();
  const supabase = getSupabaseClient();
  const acctId = normalizeAccountId(account_id);
  const token = await getTokenForAccount(supabase, acctId);
  if (!token) return { error: 'No Facebook access token found for this ad account' };
  if (!targeting) return { error: 'targeting parameter is required' };
  try {
    const url = new URL(`${base}/act_${acctId}/delivery_estimate`);
    url.searchParams.append('targeting_spec', JSON.stringify(targeting));
    url.searchParams.append('optimization_goal', optimization_goal);
    url.searchParams.append('access_token', token);
    const response = await fetch(url.toString(), { method: 'GET' });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(safeFacebookError(errorData));
    }
    return await response.json();
  } catch (error) {
    console.error('Error estimating audience size:', error);
    return { error: 'An error occurred while estimating audience size.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'estimate_audience_size',
      description: 'Estimate the potential audience size for a given targeting specification using Meta\'s delivery_estimate API. Provide a full targeting spec (age, gender, geo_locations, interests, behaviors) and get estimated reach, daily outcomes, and audience size. Useful for validating targeting before creating ad sets. The account_id is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          account_id: { type: 'string', description: 'The ad account ID (without act_ prefix).' },
          targeting: {
            type: 'object',
            description: 'Complete targeting specification including demographics, geography, interests. Example: {"age_min": 25, "age_max": 65, "geo_locations": {"countries": ["US"]}, "flexible_spec": [{"interests": [{"id": "6003371567474"}]}]}'
          },
          optimization_goal: {
            type: 'string',
            description: 'Optimization goal for estimation (default: REACH). Options: REACH, LINK_CLICKS, IMPRESSIONS, CONVERSIONS.'
          },
          base_url: { type: 'string', description: 'The base URL for the Facebook API (optional).' }
        },
        required: ['account_id', 'targeting']
      }
    }
  }
};

export { apiTool };
