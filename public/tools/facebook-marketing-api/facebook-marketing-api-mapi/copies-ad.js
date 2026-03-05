/**
 * Copy an ad in the Facebook Marketing API.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ userId, ad_id, status_option = 'PAUSED', rename_options = { rename_strategy: 'ONLY_TOP_LEVEL_RENAME' } }) => {
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };

  try {
    const url = new URL(`${getBaseUrl()}/${ad_id}/copies`);
    url.searchParams.append('status_option', status_option);
    url.searchParams.append('rename_options', JSON.stringify(rename_options));

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
    console.error('Error copying ad:', error);
    return { error: 'An error occurred while copying the ad.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'copy_ad',
      description: 'Copy an ad in the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'The user ID (Supabase auth) to retrieve the Facebook token.'
          },
          ad_id: {
            type: 'string',
            description: 'The ID of the ad to copy.'
          },
          status_option: {
            type: 'string',
            enum: ['PAUSED', 'ACTIVE', 'ARCHIVED'],
            description: 'The status for the copied ad (default: PAUSED).'
          },
          rename_options: {
            type: 'object',
            description: 'Options for renaming the copied ad (default: ONLY_TOP_LEVEL_RENAME).'
          }
        },
        required: ['userId', 'ad_id']
      }
    }
  }
};

export { apiTool };
