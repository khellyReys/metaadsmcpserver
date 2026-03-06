/**
 * Get assigned users for a specified ad account in the Facebook Marketing API.
 */
import { getSupabaseClient, getTokenForAccount } from './_token-utils.js';
import { getBaseUrl, normalizeAccountId, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ account_id, business_id, fields = "id,tasks,user_type,permitted_tasks" }) => {
  const supabase = getSupabaseClient();
  const acctId = normalizeAccountId(account_id);
  const token = await getTokenForAccount(supabase, acctId);
  if (!token) return { error: 'No Facebook access token found for this ad account' };

  try {
    const url = new URL(`${getBaseUrl()}/act_${acctId}/assigned_users`);
    url.searchParams.append('fields', fields);

    if (business_id && String(business_id).trim()) {
      url.searchParams.append('business', String(business_id).trim());
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(safeFacebookError(errorData));
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting assigned users:', error);
    return { error: 'An error occurred while getting assigned users.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_assigned_users',
      description: 'Retrieve all users assigned to a Facebook Ad Account with their roles and permissions. Works with both personal and Business Manager ad accounts. The account_id is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the ad account (without act_ prefix).'
          },
          business_id: {
            type: 'string',
            description: 'The business ID to filter by (optional -- leave empty for personal ad accounts).'
          },
          fields: {
            type: 'string',
            description: 'Comma-separated fields to retrieve (default: id,tasks,user_type,permitted_tasks).'
          }
        },
        required: ['account_id']
      }
    }
  }
};

export { apiTool };
