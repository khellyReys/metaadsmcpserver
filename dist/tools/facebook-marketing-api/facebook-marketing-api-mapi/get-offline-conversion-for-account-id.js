/**
 * Function to get offline conversion data sets for a specified ad account.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.account_id - The ID of the ad account.
 * @param {string} [args.base_url] - The base URL for the Facebook API (optional).
 * @returns {Promise<Object>} - The result of the offline conversion data set retrieval.
 */
import { getSupabaseClient, getTokenForAccount } from './_token-utils.js';
import { getBaseUrl, normalizeAccountId, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ account_id, base_url }) => {
  const baseUrl = base_url || getBaseUrl();
  const supabase = getSupabaseClient();
  const acctId = normalizeAccountId(account_id);
  const token = await getTokenForAccount(supabase, acctId);
  if (!token) return { error: 'No Facebook access token found for this ad account' };
  try {
    const url = `${baseUrl}/act_${acctId}/offline_conversion_data_sets?fields=name,id,description,valid_entries,matched_entries,event_time_min,event_time_max,event_stats,business,is_assigned_to_ad_accounts_in_business,enable_auto_assign_to_accounts,auto_track_for_ads`;

    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error retrieving offline conversion data sets:', JSON.stringify(errorData));
      throw new Error(safeFacebookError(errorData));
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error retrieving offline conversion data sets:', error);
    return { error: 'An error occurred while retrieving offline conversion data sets.' };
  }
};

/**
 * Tool configuration for retrieving offline conversion data sets for an ad account.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_offline_conversions',
      description: 'Get offline conversion data sets for a specified ad account.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the ad account.'
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