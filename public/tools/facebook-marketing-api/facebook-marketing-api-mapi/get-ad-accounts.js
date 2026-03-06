/**
 * Get ad accounts accessible by the authenticated user.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ userId, limit = 200 }) => {
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };
  try {
    const url = `${getBaseUrl()}/me/adaccounts?fields=id,name,account_status,currency,timezone_name,amount_spent,balance,business,owner&limit=${limit}&access_token=${token}`;
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(safeFacebookError(errorData));
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching ad accounts:', error);
    return { error: 'An error occurred while fetching ad accounts.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_ad_accounts',
      description: 'Retrieve all ad accounts accessible by the authenticated user. Returns account ID, name, status, currency, timezone, amount spent, balance, business info, and owner details. Use the returned account IDs (act_XXX) with other tools. The userId is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The authenticated user ID (auto-filled from server workspace if not provided).' },
          limit: { type: 'integer', description: 'Maximum number of accounts to return (default: 200).' }
        },
        required: ['userId']
      }
    }
  }
};

export { apiTool };
