/**
 * Function to search for interests on Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the search.
 * @param {string} args.userId - The user ID (Supabase auth) to retrieve the Facebook token.
 * @param {string} args.type - The type of interest to search for (e.g., adinterest).
 * @param {string} args.q - The search query for interests.
 * @param {string} args.locale - The locale for the search.
 * @param {string} [args.base_url] - The base URL for the Facebook API (optional).
 * @returns {Promise<Object>} - The result of the interest search.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';

const executeFunction = async ({ userId, type, q, locale, base_url }) => {
  const baseUrl = base_url || `https://graph.facebook.com/${process.env.FACEBOOK_API_VERSION || 'v22.0'}`;
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };
  try {
    // Construct the URL with query parameters
    const url = new URL(`${baseUrl}/search`);
    url.searchParams.append('type', type);
    url.searchParams.append('q', q);
    url.searchParams.append('locale', locale);

    // Set up headers for the request
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    // Perform the fetch request
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers
    });

    // Check if the response was successful
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error searching for interests:', JSON.stringify(errorData));
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching for interests:', error);
    return { error: 'An error occurred while searching for interests.' };
  }
};

/**
 * Tool configuration for searching interests on Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_search_interest',
      description: 'Search for interests on Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'The user ID (Supabase auth) to retrieve the Facebook token.'
          },
          type: {
            type: 'string',
            description: 'The type of interest to search for.'
          },
          q: {
            type: 'string',
            description: 'The search query for interests.'
          },
          locale: {
            type: 'string',
            description: 'The locale for the search.'
          },
          base_url: {
            type: 'string',
            description: 'The base URL for the Facebook API (optional).'
          }
        },
        required: ['userId', 'type', 'q', 'locale']
      }
    }
  }
};

export { apiTool };