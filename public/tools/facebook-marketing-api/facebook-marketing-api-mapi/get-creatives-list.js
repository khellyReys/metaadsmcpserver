/**
 * Function to get the list of ad creatives from Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.account_id - The ID of the ad account to retrieve creatives from.
 * @param {string} [args.fields] - Comma-separated list of fields to retrieve.
 * @returns {Promise<Object>} - The list of ad creatives or an error message.
 */
import { getSupabaseClient, getTokenForAccount } from './_token-utils.js';
import { getBaseUrl, normalizeAccountId, safeFacebookError } from './_shared-helpers.js';

const DEFAULT_FIELDS = 'id,name,status,object_story_spec,object_type,image_hash,video_id,body,title,thumbnail_url';

const executeFunction = async ({ account_id, fields }) => {
  const base = getBaseUrl();
  const supabase = getSupabaseClient();
  const token = await getTokenForAccount(supabase, account_id);
  if (!token) return { error: 'No Facebook access token found for this ad account' };

  const acctId = normalizeAccountId(account_id);
  const requestFields = fields || DEFAULT_FIELDS;

  try {
    const url = new URL(`${base}/act_${acctId}/adcreatives`);
    url.searchParams.append('fields', requestFields);

    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url.toString(), { method: 'GET', headers });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error fetching ad creatives:', JSON.stringify(errorData));
      throw new Error(safeFacebookError(errorData));
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching ad creatives:', error);
    return { error: 'An error occurred while fetching ad creatives.' };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_creatives_list',
      description: 'List all ad creatives in a Facebook Ad Account with details: title, body, image/video assets, call-to-action, object story spec, and link URL. Supports optional field selection. The account_id is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the ad account to retrieve creatives from.'
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
