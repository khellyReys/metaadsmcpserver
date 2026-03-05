/**
 * Function to get the list of ad sets from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.account_id - The ID of the ad account to retrieve ad sets from.
 * @param {string} [args.fields] - Comma-separated list of fields to retrieve.
 * @returns {Promise<Object>} - The list of ad sets or an error message.
 */
import { getSupabaseClient, getTokenForAccount } from './_token-utils.js';
import { getBaseUrl, normalizeAccountId, safeFacebookError } from './_shared-helpers.js';

const DEFAULT_FIELDS = 'id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget,budget_remaining,optimization_goal,billing_event,bid_strategy,targeting,start_time,end_time,created_time';

const executeFunction = async ({ account_id, fields }) => {
  const base = getBaseUrl();
  const supabase = getSupabaseClient();
  const token = await getTokenForAccount(supabase, account_id);
  if (!token) return { error: 'No Facebook access token found for this ad account' };

  const acctId = normalizeAccountId(account_id);
  const requestFields = fields || DEFAULT_FIELDS;

  try {
    const url = new URL(`${base}/act_${acctId}/adsets`);
    url.searchParams.append('fields', requestFields);

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url.toString(), { method: 'GET', headers });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error retrieving ad sets:', JSON.stringify(errorData));
      throw new Error(safeFacebookError(errorData));
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error retrieving ad sets:', error);
    return { error: 'An error occurred while retrieving ad sets.' };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_adsets_list',
      description: 'Get a list of ad sets from the specified ad account.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the ad account to retrieve ad sets from.'
          },
          fields: {
            type: 'string',
            description: 'Comma-separated list of fields to retrieve (optional).'
          }
        },
        required: ['account_id']
      }
    }
  }
};

export { apiTool };
