/**
 * Update an existing Facebook ad creative's name or optimization settings.
 * Note: Meta API does NOT allow updating content fields (message, headline, image, video)
 * on existing creatives. To change ad content, create a new creative and update the ad.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ userId, creative_id, name, optimization_type }) => {
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };
  try {
    const body = {};
    if (name) body.name = name;
    if (optimization_type) body.optimization_type = optimization_type;

    if (Object.keys(body).length === 0) {
      return { error: 'At least one field to update is required (name or optimization_type).' };
    }

    const response = await fetch(`${getBaseUrl()}/${creative_id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(safeFacebookError(errorData));
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating creative:', error);
    return { error: 'An error occurred while updating the creative.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'update_ad_creative',
      description: 'Update an existing Facebook ad creative. Only the creative name and optimization_type (DEGREES_OF_FREEDOM for Advantage+) can be changed. Meta does NOT allow updating content fields (message, headline, image, video) on existing creatives -- to change ad content, create a new creative and update the ad to reference it. The userId is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The authenticated user ID (auto-filled from server workspace if not provided).' },
          creative_id: { type: 'string', description: 'The ID of the creative to update.' },
          name: { type: 'string', description: 'New creative name.' },
          optimization_type: { type: 'string', description: 'Set to "DEGREES_OF_FREEDOM" for Advantage+ creatives (optional).' }
        },
        required: ['userId', 'creative_id']
      }
    }
  }
};

export { apiTool };
