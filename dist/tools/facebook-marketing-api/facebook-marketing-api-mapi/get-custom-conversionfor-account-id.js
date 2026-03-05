/**
 * Function to get custom conversions for a specified ad account ID from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.account_id - The ID of the ad account to retrieve custom conversions for.
 * @returns {Promise<Object>} - The response from the Facebook Marketing API containing custom conversions.
 */
import { getSupabaseClient, getTokenForAccount } from './_token-utils.js';
import { getBaseUrl, normalizeAccountId, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ account_id }) => {
  const base = getBaseUrl();
  const supabase = getSupabaseClient();
  const token = await getTokenForAccount(supabase, account_id);
  if (!token) return { error: 'No Facebook access token found for this ad account' };

  const acctId = normalizeAccountId(account_id);

  try {
    const url = `${base}/act_${acctId}/customconversions?fields=account_id,creation_time,custom_event_type,default_conversion_value,description,data_sources,first_fired_time,is_archived,last_fired_time,name,pixel,rule,id`;

    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url, { method: 'GET', headers });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error fetching custom conversions:', JSON.stringify(errorData));
      throw new Error(safeFacebookError(errorData));
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching custom conversions:', error);
    return { error: 'An error occurred while fetching custom conversions.' };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_custom_conversions',
      description: 'Get custom conversions for a specified ad account ID.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the ad account to retrieve custom conversions for.'
          }
        },
        required: ['account_id']
      }
    }
  }
};

export { apiTool };
