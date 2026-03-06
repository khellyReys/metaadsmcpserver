/**
 * Search for Facebook Pages by name within an ad account.
 */
import { getSupabaseClient, getTokenForAccount } from './_token-utils.js';
import { getBaseUrl, normalizeAccountId, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ account_id, search_term, base_url }) => {
  const base = base_url || getBaseUrl();
  const supabase = getSupabaseClient();
  const acctId = normalizeAccountId(account_id);
  const token = await getTokenForAccount(supabase, acctId);
  if (!token) return { error: 'No Facebook access token found for this ad account' };
  try {
    let url = `${base}/act_${acctId}/promote_pages?fields=id,name,category,fan_count,picture,link`;
    if (search_term) {
      url += `&name=${encodeURIComponent(search_term)}`;
    }
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
    console.error('Error searching pages:', error);
    return { error: 'An error occurred while searching pages.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'search_pages_by_name',
      description: 'Search for Facebook Pages by name within an ad account. Returns matching pages with ID, name, category, and fan count. If no search_term is provided, returns all pages for the account. The account_id is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          account_id: { type: 'string', description: 'The ad account ID (without act_ prefix).' },
          search_term: { type: 'string', description: 'Search term to filter pages by name (optional).' },
          base_url: { type: 'string', description: 'The base URL for the Facebook API (optional).' }
        },
        required: ['account_id']
      }
    }
  }
};

export { apiTool };
