/**
 * Duplicate a Facebook Ads campaign with all its ad sets and ads.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ userId, campaign_id, name_suffix = ' - Copy', new_status = 'PAUSED' }) => {
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };
  try {
    const url = new URL(`${getBaseUrl()}/${campaign_id}/copies`);
    const params = {
      rename_options: JSON.stringify({ rename_suffix: name_suffix, rename_strategy: 'DEEP_RENAME' }),
      status_option: new_status,
      deep_copy: 'true'
    };
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
    console.error('Error duplicating campaign:', error);
    return { error: 'An error occurred while duplicating the campaign.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'duplicate_campaign',
      description: 'Duplicate a Facebook Ads campaign including all its ad sets and ads. Creates a deep copy with an optional name suffix. The duplicated campaign starts in the specified status (default: PAUSED). Useful for A/B testing or creating seasonal variations. The userId is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The authenticated user ID (auto-filled from server workspace if not provided).' },
          campaign_id: { type: 'string', description: 'The ID of the campaign to duplicate.' },
          name_suffix: { type: 'string', description: 'Suffix to append to the duplicated campaign name (default: " - Copy").' },
          new_status: { type: 'string', enum: ['ACTIVE', 'PAUSED'], description: 'Status for the duplicated campaign (default: PAUSED).' }
        },
        required: ['userId', 'campaign_id']
      }
    }
  }
};

export { apiTool };
