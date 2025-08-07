/**
 * Function to get report insights for a specific ad account from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the report request.
 * @param {string} args.account_id - The ID of the ad account to retrieve insights for.
 * @param {string} args.token - The Bearer token for authorization.
 * @param {string} [args.since="2023-03-13"] - The start date for the time range.
 * @param {string} [args.until="2023-06-11"] - The end date for the time range.
 * @param {number} [args.limit=100] - The number of results to return.
 * @param {string} [args.fields="spend, account_currency"] - The fields to include in the response.
 * @param {string} [args.time_increment="all_days"] - The time increment for the insights.
 * @returns {Promise<Object>} - The result of the report insights request.
 */
const executeFunction = async ({ account_id, token, since = "2023-03-13", until = "2023-06-11", limit = 100, fields = "spend, account_currency", time_increment = "all_days" }) => {
  const base_url = 'https://graph.facebook.com/v12.0'; // Facebook Marketing API base URL
  try {
    // Construct the URL with query parameters
    const url = new URL(`${base_url}/act_${account_id}/insights`);
    url.searchParams.append('time_range', JSON.stringify({ since, until }));
    url.searchParams.append('limit', limit.toString());
    url.searchParams.append('fields', fields);
    url.searchParams.append('time_increment', time_increment);
    url.searchParams.append('format', 'json');

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
      console.error('Error getting report insights:', JSON.stringify(errorData));
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting report insights:', error);
    return { error: 'An error occurred while retrieving report insights.' };
  }
};

/**
 * Tool configuration for getting report insights from the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetReportForInsight2',
      description: 'Get report insights for a specific ad account from the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the ad account to retrieve insights for.'
          },
          token: {
            type: 'string',
            description: 'The Bearer token for authorization.'
          },
          since: {
            type: 'string',
            description: 'The start date for the time range.'
          },
          until: {
            type: 'string',
            description: 'The end date for the time range.'
          },
          limit: {
            type: 'integer',
            description: 'The number of results to return.'
          },
          fields: {
            type: 'string',
            description: 'The fields to include in the response.'
          },
          time_increment: {
            type: 'string',
            description: 'The time increment for the insights.'
          }
        },
        required: ['account_id', 'token']
      }
    }
  }
};

export { apiTool };