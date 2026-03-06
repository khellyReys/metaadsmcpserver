/**
 * Duplicate a Facebook Ads ad set with its ads.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ userId, adset_id, target_campaign_id, name_suffix = ' - Copy', new_status = 'PAUSED' }) => {
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };
  try {
    const url = new URL(`${getBaseUrl()}/${adset_id}/copies`);
    const params = {
      rename_options: JSON.stringify({ rename_suffix: name_suffix, rename_strategy: 'DEEP_RENAME' }),
      status_option: new_status,
      deep_copy: 'true'
    };
    if (target_campaign_id) params.campaign_id = target_campaign_id;
    for (const [k, v] of Object.entries(params)) url.searchParams.append(k, v);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(safeFacebookError(errorData));
    }
    return await response.json();
  } catch (error) {
    console.error('Error duplicating adset:', error);
    return { error: 'An error occurred while duplicating the ad set.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'duplicate_adset',
      description: 'Duplicate a Facebook ad set including all its ads. Optionally move the copy to a different campaign via target_campaign_id. The duplicated ad set starts in the specified status (default: PAUSED). Useful for testing different targeting or budgets. The userId is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The authenticated user ID (auto-filled from server workspace if not provided).' },
          adset_id: { type: 'string', description: 'The ID of the ad set to duplicate.' },
          target_campaign_id: { type: 'string', description: 'Campaign ID to place the duplicated ad set in (optional, stays in same campaign if omitted).' },
          name_suffix: { type: 'string', description: 'Suffix to append to the duplicated ad set name (default: " - Copy").' },
          new_status: { type: 'string', enum: ['ACTIVE', 'PAUSED'], description: 'Status for the duplicated ad set (default: PAUSED).' }
        },
        required: ['userId', 'adset_id']
      }
    }
  }
};

export { apiTool };
