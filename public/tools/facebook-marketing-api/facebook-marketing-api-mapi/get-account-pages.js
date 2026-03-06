/**
 * Get Facebook Pages associated with an ad account that can be used for ad creation.
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
    const url = `${base}/act_${acctId}/promote_pages?fields=id,name,category,fan_count,picture,link,is_published`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(safeFacebookError(errorData));
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching account pages:', error);
    return { error: 'An error occurred while fetching account pages.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_account_pages',
      description: 'Retrieve Facebook Pages associated with an ad account. Returns page ID, name, category, fan count, and profile picture. Use the returned page IDs as page_id when creating ads and ad creatives. The account_id is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          account_id: { type: 'string', description: 'The ad account ID (without act_ prefix).' },
          base_url: { type: 'string', description: 'The base URL for the Facebook API (optional).' }
        },
        required: ['account_id']
      }
    }
  }
};

export { apiTool };
