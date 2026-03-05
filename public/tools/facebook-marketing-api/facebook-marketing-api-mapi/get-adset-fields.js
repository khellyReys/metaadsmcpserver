/**
 * Function to get ad set fields from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the ad set fields retrieval.
 * @param {string} args.userId - The user ID (Supabase auth) to retrieve the Facebook token.
 * @param {string} args.adset_id - The ID of the ad set to retrieve fields for.
 * @returns {Promise<Object>} - The result of the ad set fields retrieval.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const FIELDS = 'account_id,campaign_id,created_time,effective_status,id,name,recommendations,status,daily_budget,lifetime_budget,budget_remaining,optimization_goal,billing_event,bid_strategy,bid_amount,targeting,start_time,end_time,promoted_object';

const executeFunction = async ({ userId, adset_id }) => {
  const base = getBaseUrl();
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };
  try {
    const url = new URL(`${base}/${adset_id}`);
    url.searchParams.append('fields', FIELDS);

    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url.toString(), { method: 'GET', headers });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error retrieving ad set fields:', JSON.stringify(errorData));
      throw new Error(safeFacebookError(errorData));
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error retrieving ad set fields:', error);
    return { error: 'An error occurred while retrieving ad set fields.' };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_adset_fields',
      description: 'Retrieve fields for a specific ad set from the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'The user ID (Supabase auth) to retrieve the Facebook token.'
          },
          adset_id: {
            type: 'string',
            description: 'The ID of the ad set to retrieve fields for.'
          }
        },
        required: ['userId', 'adset_id']
      }
    }
  }
};

export { apiTool };
