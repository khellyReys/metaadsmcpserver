/**
 * Function to get the Ad Account details from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.account_id - The ID of the ad account to retrieve.
 * @param {string} [args.base_url] - The base URL for the Facebook API (default uses FACEBOOK_API_VERSION).
 * @returns {Promise<Object>} - The details of the ad account.
 */
import { getSupabaseClient, getTokenForAccount } from './_token-utils.js';
import { getBaseUrl, normalizeAccountId, safeFacebookError } from './_shared-helpers.js';

const DEFAULT_FIELDS = 'id,name,account_id,account_status,age,amount_spent,balance,business,business_city,business_country_code,currency,timezone_name,timezone_offset_hours_utc';

const executeFunction = async ({ account_id, fields, base_url }) => {
  const base = base_url || getBaseUrl();
  const supabase = getSupabaseClient();
  const acctId = normalizeAccountId(account_id);
  const token = await getTokenForAccount(supabase, acctId);
  if (!token) {
    return { error: 'No Facebook access token found for this ad account' };
  }
  try {
    const url = new URL(`${base}/act_${acctId}`);
    url.searchParams.append('fields', fields || DEFAULT_FIELDS);
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    const response = await fetch(url.toString(), { method: 'GET', headers });
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error fetching ad account details:', JSON.stringify(errorData));
      throw new Error(safeFacebookError(errorData));
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching ad account details:', error);
    return { error: error.message || 'An error occurred while fetching ad account details.' };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_ad_account',
      description: 'Retrieve details of an ad account from the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the ad account to retrieve.'
          },
          fields: {
            type: 'string',
            description: 'Comma-separated list of fields to retrieve (optional, defaults to comprehensive fields).'
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
