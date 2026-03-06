/**
 * Function to get details from an Ad ID using the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.userId - The authenticated user ID.
 * @param {string} args.ad_id - The ID of the ad to retrieve details for.
 * @param {string} [args.base_url] - The base URL for the Facebook Marketing API (optional).
 * @returns {Promise<Object>} - The details of the ad.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ userId, ad_id, base_url }) => {
  const base = base_url || getBaseUrl();
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };
  try {
    const url = `${base}/${ad_id}/?fields=account_id,adset_id,bid_amount,campaign_id,configured_status,conversion_specs,created_time,creative,display_sequence,effective_status,id,last_updated_by_app_id,name,priority,recommendations,source_ad_id,status,targeting,tracking_specs,updated_time`;

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error getting ad details:', JSON.stringify(errorData));
      throw new Error(safeFacebookError(errorData));
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting ad details:', error);
    return { error: 'An error occurred while retrieving ad details.' };
  }
};

/**
 * Tool configuration for getting details from an Ad ID using the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_ad_details',
      description: 'Retrieve full details of a single Facebook ad by its ID, including name, status, creative details, targeting, bid info, tracking specs, and conversion specs. The userId is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'The authenticated user ID (auto-filled from server workspace if not provided).'
          },
          ad_id: {
            type: 'string',
            description: 'The ID of the ad to retrieve details for.'
          },
          base_url: {
            type: 'string',
            description: 'The base URL for the Facebook Marketing API (optional).'
          }
        },
        required: ['userId', 'ad_id']
      }
    }
  }
};

export { apiTool };