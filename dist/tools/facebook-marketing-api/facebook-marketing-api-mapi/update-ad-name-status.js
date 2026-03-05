/**
 * Update the name and/or status of an ad in the Facebook Marketing API.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ userId, ad_id, name, status = 'PAUSED' }) => {
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };

  try {
    const url = new URL(`${getBaseUrl()}/${ad_id}`);
    if (name) url.searchParams.append('name', name);
    if (status) url.searchParams.append('status', status);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(safeFacebookError(errorData));
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating ad:', error);
    return { error: 'An error occurred while updating the ad.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'update_ad_status',
      description: 'Update the name and/or status of an ad in the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'The user ID (Supabase auth) to retrieve the Facebook token.'
          },
          ad_id: {
            type: 'string',
            description: 'The ID of the ad to update.'
          },
          name: {
            type: 'string',
            description: 'The new name for the ad (optional).'
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'PAUSED', 'ARCHIVED'],
            description: 'The new status for the ad (default: PAUSED).'
          }
        },
        required: ['userId', 'ad_id']
      }
    }
  }
};

export { apiTool };
