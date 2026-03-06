/**
 * Update an existing Facebook ad by its ID. Change the ad name and/or status (ACTIVE, PAUSED, ARCHIVED). Only provided fields are modified. The userId is auto-filled from server workspace if not provided.
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
      description: 'Update an existing Facebook ad by its ID. Change the ad name and/or status (ACTIVE, PAUSED, ARCHIVED). Only provided fields are modified. The userId is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'The authenticated user ID (auto-filled from server workspace if not provided).'
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
