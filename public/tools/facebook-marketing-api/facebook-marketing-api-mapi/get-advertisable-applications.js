/**
 * Function to get advertisable applications from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.account_id - The ad account ID to fetch advertisable applications for.
 * @param {string} [args.base_url] - The base URL for the Facebook API (optional).
 * @returns {Promise<Object>} - The result of the request containing advertisable applications.
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
    const url = `${baseUrl}/act_${acctId}/advertisable_applications?fields=id,name,app_install_tracked,app_name,app_type,category,icon_url,ipad_app_store_id,iphone_app_store_id,link,mobile_web_url,object_store_urls,supported_platforms,website_url,photo_url,advertisable_app_events`;

    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error fetching advertisable applications:', JSON.stringify(errorData));
      throw new Error(safeFacebookError(errorData));
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching advertisable applications:', error);
    return { error: 'An error occurred while fetching advertisable applications.' };
  }
};

/**
 * Tool configuration for fetching advertisable applications from the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_advertisable_applications',
      description: 'Fetches advertisable applications for a given ad account.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ad account ID to fetch advertisable applications for.'
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