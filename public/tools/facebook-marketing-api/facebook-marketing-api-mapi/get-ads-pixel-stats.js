/**
 * Function to get Ads Pixel statistics from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.pixel_id - The ID of the pixel for which to retrieve statistics.
 * @param {string} args.userId - The authenticated user ID.
 * @param {string} [args.base_url] - The base URL for the Facebook Graph API (optional).
 * @returns {Promise<Object>} - The statistics for the specified Ads Pixel.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';

const executeFunction = async ({ pixel_id, userId, base_url }) => {
  const base = base_url || `https://graph.facebook.com/${process.env.FACEBOOK_API_VERSION || 'v22.0'}`;
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };
  try {
    const url = `${base}/${pixel_id}/stats`;
    const headers = { 'Authorization': `Bearer ${token}` };
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error fetching Ads Pixel statistics:', JSON.stringify(errorData));
      throw new Error(errorData?.error?.message || response.statusText);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching Ads Pixel statistics:', error);
    return { error: error.message || 'An error occurred while fetching Ads Pixel statistics.' };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_pixel_stats',
      description: 'Retrieve event statistics for a Facebook Pixel by its ID, including total events fired, event breakdown by type (PageView, Purchase, Lead, etc.), last fired time, and data processing status. The userId is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          pixel_id: {
            type: 'string',
            description: 'The ID of the pixel for which to retrieve statistics.'
          },
          userId: {
            type: 'string',
            description: 'The authenticated user ID (auto-filled from server workspace if not provided).'
          },
          base_url: {
            type: 'string',
            description: 'The base URL for the Facebook Graph API (optional).'
          }
        },
        required: ['pixel_id', 'userId']
      }
    }
  }
};

export { apiTool };
