/**
 * Function to get creative details from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.adCreativeId - The ID of the ad creative to retrieve details for.
 * @param {string} args.userId - The user ID to retrieve the Facebook token from Supabase.
 * @param {string} [args.base_url] - The base URL for the Facebook Graph API (optional).
 * @returns {Promise<Object>} - The details of the ad creative.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';

const executeFunction = async ({ adCreativeId, userId, base_url }) => {
  const base = base_url || `https://graph.facebook.com/${process.env.FACEBOOK_API_VERSION || 'v22.0'}`;
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };
  try {
    const url = `${base}/${adCreativeId}/?fields=name,object_story_id,object_story_spec{},object_type,image_hash,video_id,body,title,status`;
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error getting creative details:', JSON.stringify(errorData));
      throw new Error(errorData?.error?.message || response.statusText);
    }
    return await response.json();
  } catch (error) {
    console.error('Error getting creative details:', error);
    return { error: error.message || 'An error occurred while retrieving creative details.' };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_creative_details',
      description: 'Retrieve details of a specific ad creative.',
      parameters: {
        type: 'object',
        properties: {
          adCreativeId: {
            type: 'string',
            description: 'The ID of the ad creative to retrieve details for.'
          },
          userId: {
            type: 'string',
            description: 'The user ID (Supabase auth) to retrieve the Facebook token.'
          },
          base_url: {
            type: 'string',
            description: 'The base URL for the Facebook Graph API (optional).'
          }
        },
        required: ['adCreativeId', 'userId']
      }
    }
  }
};

export { apiTool };
