/**
 * Get all available behavior targeting options from the Facebook Marketing API.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ userId, limit = 50 }) => {
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };
  try {
    const url = `${getBaseUrl()}/search?type=adTargetingCategory&class=behaviors&limit=${limit}&access_token=${token}`;
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(safeFacebookError(errorData));
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching behaviors:', error);
    return { error: 'An error occurred while fetching behavior targeting options.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'search_behaviors',
      description: 'Retrieve all available behavior targeting options from Facebook, including purchase behaviors, device usage, travel patterns, and digital activities. Returns behavior ID, name, audience size, path, and description. Use the returned IDs in ad set targeting flexible_spec. The userId is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The authenticated user ID (auto-filled from server workspace if not provided).' },
          limit: { type: 'integer', description: 'Maximum number of results to return (default: 50).' }
        },
        required: ['userId']
      }
    }
  }
};

export { apiTool };
