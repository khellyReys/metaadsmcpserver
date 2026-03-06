/**
 * Function to get report insights from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.userId - The authenticated user ID.
 * @param {string} args.report_id_breakdowns - The report ID for which to get insights.
 * @returns {Promise<Object>} - The insights data for the specified report ID.
 */
import { getSupabaseClient, getTokenForUser } from './_token-utils.js';
import { getBaseUrl, safeFacebookError } from './_shared-helpers.js';

const executeFunction = async ({ userId, report_id_breakdowns }) => {
  const base = getBaseUrl();
  const supabase = getSupabaseClient();
  const token = await getTokenForUser(supabase, userId);
  if (!token) return { error: 'No Facebook access token found for this user' };
  try {
    const url = `${base}/${report_id_breakdowns}/insights`;

    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url, { method: 'GET', headers });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error fetching report insights:', JSON.stringify(errorData));
      throw new Error(safeFacebookError(errorData));
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching report insights:', error);
    return { error: 'An error occurred while fetching insights.' };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_report_insights',
      description: 'Fetch the results of a previously generated async report by its report ID. Returns the breakdown data (e.g., by age, gender, country) that was requested when the report was created with generate_report_breakdown. The userId is auto-filled from server workspace if not provided.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'The authenticated user ID (auto-filled from server workspace if not provided).'
          },
          report_id_breakdowns: {
            type: 'string',
            description: 'The report ID for which to get insights.'
          }
        },
        required: ['userId', 'report_id_breakdowns']
      }
    }
  }
};

export { apiTool };
