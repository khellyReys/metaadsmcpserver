/**
 * Function to get targeting categories from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.account_id - The ID of the ad account.
 * @param {string} [args.base_url] - The base URL for the API (optional).
 * @returns {Promise<Object>} - The response from the API containing targeting categories.
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
    const url = `${base}/act_${acctId}/broadtargetingcategories`;

    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error getting targeting categories:', JSON.stringify(errorData));
      throw new Error(safeFacebookError(errorData));
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting targeting categories:', error);
    return { error: 'An error occurred while getting targeting categories.' };
  }
};

/**
 * Tool configuration for getting targeting categories from the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_targeting_categories',
      description: 'Get targeting categories from the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the ad account.'
          },
          base_url: {
            type: 'string',
            description: 'The base URL for the API (optional).'
          }
        },
        required: ['account_id']
      }
    }
  }
};

export { apiTool };