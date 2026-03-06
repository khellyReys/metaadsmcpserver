/**
 * Search for interests, locations, demographics, and other targeting options
 * on the Facebook Marketing API.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ userId, type = 'adinterest', query, locale = 'en_US' }) => {
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };

  if (!query || !String(query).trim()) {
    return { error: 'query is required. Enter a keyword to search for (e.g. "fitness", "Manila", "engineering").' };
  }

  try {
    const url = new URL(`${getBaseUrl()}/search`);
    url.searchParams.append('type', type);
    url.searchParams.append('q', query);
    url.searchParams.append('locale', locale);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(safeFacebookError(errorData));
    }

    return await response.json();
  } catch (error) {
    console.error('Error in search:', error);
    return { error: 'An error occurred while searching.', details: error.message };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_search_interest',
      description: 'Search Facebook targeting options by keyword query. Returns matching interests, behaviors, demographics, employers, job titles, and locations with audience size estimates. Use the returned IDs in ad set flexible_spec targeting. The userId is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'The authenticated user ID (auto-filled from server workspace if not provided).'
          },
          type: {
            type: 'string',
            enum: [
              'adinterest',
              'adinterestsuggestion',
              'adinterestvalid',
              'adgeolocation',
              'adcountry',
              'adregion',
              'adcity',
              'adlocale',
              'adTargetingCategory',
              'adeducationschool',
              'adeducationmajor',
              'adworkemployer',
              'adworkposition'
            ],
            description: 'What to search for (default: adinterest). Examples: "adinterest" for interests like fitness/cooking, "adgeolocation" for cities/regions, "adworkposition" for job titles, "adinterestsuggestion" for related interests.'
          },
          query: {
            type: 'string',
            description: 'The search keyword. Examples: "fitness" (interests), "Manila" (locations), "engineering" (job titles), "Harvard" (schools).'
          },
          locale: {
            type: 'string',
            enum: ['en_US', 'en_GB', 'es_ES', 'fr_FR', 'de_DE', 'it_IT', 'pt_BR', 'ja_JP', 'ko_KR', 'zh_CN', 'zh_TW', 'fil_PH', 'tl_PH', 'th_TH', 'vi_VN', 'id_ID', 'ms_MY', 'ar_AR', 'hi_IN'],
            description: 'Locale for results (default: en_US). Use fil_PH for Filipino, tl_PH for Tagalog.'
          }
        },
        required: ['userId', 'query']
      }
    }
  }
};

export { apiTool };
