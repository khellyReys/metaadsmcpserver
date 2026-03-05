/**
 * Function to get campaign details from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the campaign retrieval.
 * @param {string} args.userId - The user ID (Supabase auth) to retrieve the Facebook token.
 * @param {string} args.campaign_id - The ID of the campaign to retrieve.
 * @returns {Promise<Object>} - The details of the campaign.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ userId, campaign_id }) => {
  const base = getBaseUrl();
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };
  try {
    const url = new URL(`${base}/`);
    url.searchParams.append('ids', campaign_id);
    url.searchParams.append('fields', 'id,account_id,objective,name,configured_status,effective_status,buying_type,created_time,updated_time,spend_cap,can_use_spend_cap,issues_info,special_ad_categories');

    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url.toString(), { method: 'GET', headers });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error retrieving campaign details:', JSON.stringify(errorData));
      throw new Error(safeFacebookError(errorData));
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error retrieving campaign details:', error);
    return { error: 'An error occurred while retrieving campaign details.' };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_campaign_with_fields',
      description: 'Get details of a specific campaign from the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'The user ID (Supabase auth) to retrieve the Facebook token.'
          },
          campaign_id: {
            type: 'string',
            description: 'The ID of the campaign to retrieve.'
          }
        },
        required: ['userId', 'campaign_id']
      }
    }
  }
};

export { apiTool };
