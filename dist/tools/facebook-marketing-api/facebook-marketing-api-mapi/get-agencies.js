/**
 * Function to get agencies associated with a Facebook Ad Account.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.account_id - The ID of the Facebook Ad Account.
 * @param {string} [args.base_url] - The base URL for the API (optional).
 * @returns {Promise<Array>} - The list of agencies associated with the Ad Account.
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
    const url = `${base}/act_${acctId}/agencies?fields=permitted_tasks`;

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
      console.error('Error fetching agencies:', JSON.stringify(errorData));
      throw new Error(safeFacebookError(errorData));
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching agencies:', error);
    return { error: 'An error occurred while fetching agencies.' };
  }
};

/**
 * Tool configuration for getting agencies from Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_agencies',
      description: 'Get agencies associated with a Facebook Ad Account.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the Facebook Ad Account.'
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