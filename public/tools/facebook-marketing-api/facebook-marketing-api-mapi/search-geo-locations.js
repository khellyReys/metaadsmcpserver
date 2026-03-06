/**
 * Search for geographic targeting locations on the Facebook Marketing API.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ userId, query, location_types, limit = 25 }) => {
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };
  try {
    const url = new URL(`${getBaseUrl()}/search`);
    url.searchParams.append('type', 'adgeolocation');
    url.searchParams.append('q', query);
    url.searchParams.append('limit', String(limit));
    url.searchParams.append('access_token', token);
    if (location_types && location_types.length > 0) {
      url.searchParams.append('location_types', JSON.stringify(location_types));
    }
    const response = await fetch(url.toString(), { method: 'GET' });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(safeFacebookError(errorData));
    }
    return await response.json();
  } catch (error) {
    console.error('Error searching geo locations:', error);
    return { error: 'An error occurred while searching geographic locations.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'search_geo_locations',
      description: 'Search for geographic targeting locations by keyword (cities, regions, countries, zip codes, DMAs). Returns location key, name, type, country, and geographic hierarchy. Use the returned keys and types in ad set geo_locations targeting. The userId is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The authenticated user ID (auto-filled from server workspace if not provided).' },
          query: { type: 'string', description: 'Search term for locations (e.g., "New York", "California", "Japan").' },
          location_types: {
            type: 'array',
            items: { type: 'string', enum: ['country', 'region', 'city', 'zip', 'geo_market', 'electoral_district'] },
            description: 'Types of locations to search (optional, searches all types if not provided).'
          },
          limit: { type: 'integer', description: 'Maximum number of results to return (default: 25).' }
        },
        required: ['userId', 'query']
      }
    }
  }
};

export { apiTool };
