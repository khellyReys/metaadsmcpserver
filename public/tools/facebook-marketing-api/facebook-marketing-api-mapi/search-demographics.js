/**
 * Get demographic targeting options from the Facebook Marketing API.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ userId, demographic_class = 'demographics', limit = 50 }) => {
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };
  try {
    const url = `${getBaseUrl()}/search?type=adTargetingCategory&class=${encodeURIComponent(demographic_class)}&limit=${limit}&access_token=${token}`;
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(safeFacebookError(errorData));
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching demographics:', error);
    return { error: 'An error occurred while fetching demographic targeting options.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'search_demographics',
      description: 'Retrieve demographic targeting options from Facebook. Supports multiple demographic classes: demographics, life_events, industries, income, family_statuses, user_device, user_os. Returns targeting option ID, name, audience size, and path. Use the returned IDs in ad set targeting flexible_spec. The userId is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The authenticated user ID (auto-filled from server workspace if not provided).' },
          demographic_class: {
            type: 'string',
            enum: ['demographics', 'life_events', 'industries', 'income', 'family_statuses', 'user_device', 'user_os'],
            description: 'Type of demographics to retrieve (default: demographics).'
          },
          limit: { type: 'integer', description: 'Maximum number of results to return (default: 50).' }
        },
        required: ['userId']
      }
    }
  }
};

export { apiTool };
