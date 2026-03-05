/**
 * Function to get Instagram accounts associated with a Facebook Ad Account.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.account_id - The Facebook Ad Account ID.
 * @param {string} [args.base_url] - The base URL for the Facebook Marketing API (optional).
 * @returns {Promise<Object>} - The result of the Instagram accounts retrieval.
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
    const url = `${base}/act_${acctId}/instagram_accounts?fields=id,username,profile_pic`;

    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error retrieving Instagram accounts:', JSON.stringify(errorData));
      throw new Error(safeFacebookError(errorData));
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error retrieving Instagram accounts:', error);
    return { error: 'An error occurred while retrieving Instagram accounts.' };
  }
};

/**
 * Tool configuration for retrieving Instagram accounts from Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_ig_accounts',
      description: 'Retrieve Instagram accounts associated with a Facebook Ad Account.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The Facebook Ad Account ID.'
          },
          base_url: {
            type: 'string',
            description: 'The base URL for the Facebook Marketing API (optional).'
          }
        },
        required: ['account_id']
      }
    }
  }
};

export { apiTool };