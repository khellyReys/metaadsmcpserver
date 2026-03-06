/**
 * Get interest suggestions based on existing interests from the Facebook Marketing API.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ userId, interest_list, limit = 25 }) => {
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };
  try {
    const url = new URL(`${getBaseUrl()}/search`);
    url.searchParams.append('type', 'adinterestsuggestion');
    url.searchParams.append('interest_list', JSON.stringify(interest_list));
    url.searchParams.append('limit', String(limit));
    url.searchParams.append('access_token', token);
    const response = await fetch(url.toString(), { method: 'GET' });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(safeFacebookError(errorData));
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching interest suggestions:', error);
    return { error: 'An error occurred while fetching interest suggestions.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_interest_suggestions',
      description: 'Get related interest suggestions based on a list of existing interest names. Provide interests like ["Basketball", "Soccer"] to discover related targeting options with their IDs, names, audience sizes, and descriptions. Use the results to expand ad set targeting. The userId is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The authenticated user ID (auto-filled from server workspace if not provided).' },
          interest_list: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of interest names to get suggestions for (e.g., ["Basketball", "Soccer"]).'
          },
          limit: { type: 'integer', description: 'Maximum number of suggestions to return (default: 25).' }
        },
        required: ['userId', 'interest_list']
      }
    }
  }
};

export { apiTool };
