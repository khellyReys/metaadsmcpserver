/**
 * Function to get ads from a specified Facebook Ad Account.
 *
 * @param {Object} args - Arguments for the ad retrieval.
 * @param {string} args.account_id - The ID of the ad account to retrieve ads from.
 * @param {string} [args.base_url] - The base URL for the Facebook API (optional).
 * @returns {Promise<Object>} - The result of the ad retrieval.
 */
import { getSupabaseClient, getTokenForAccount } from './_token-utils.js';
import { getBaseUrl, normalizeAccountId, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ account_id, base_url }) => {
  const base = base_url || getBaseUrl();
  const supabase = getSupabaseClient();
  const acctId = normalizeAccountId(account_id);
  const token = await getTokenForAccount(supabase, acctId);
  if (!token) return { error: 'No Facebook access token found for this ad account' };

  try {
    const url = `${base}/act_${acctId}/ads?fields=id,name,bid_amount,adset_id,creative{effective_instagram_story_id,effective_instagram_media_id,instagram_permalink_url},status,effective_status,created_time,updated_time,tracking_specs,conversion_specs,ad_review_feedback,adlabels,issues_info,conversion_domain,campaign_id`;

    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error retrieving ads:', JSON.stringify(errorData));
      throw new Error(safeFacebookError(errorData));
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error retrieving ads:', error);
    return { error: 'An error occurred while retrieving ads.' };
  }
};

/**
 * Tool configuration for retrieving ads from a Facebook Ad Account.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_ads_list',
      description: 'List all ads in a Facebook Ad Account with key fields: name, status, creative ID, ad set ID, campaign ID, and delivery info. Returns a paginated list of all ads under the account. The account_id is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the ad account to retrieve ads from.'
          },
          base_url: {
            type: 'string',
            description: 'The base URL for the Facebook API (optional).'
          }
        },
        required: ['account_id']
      }
    }
  }
};

export { apiTool };