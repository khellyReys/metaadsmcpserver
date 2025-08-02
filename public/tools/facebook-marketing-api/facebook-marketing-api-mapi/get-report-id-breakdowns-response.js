/**
 * Function to get report ID breakdowns insights from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.base_url - The base URL for the Facebook Marketing API.
 * @param {string} args.report_id_breakdowns - The report ID for which to get insights.
 * @returns {Promise<Object>} - The insights data for the specified report ID.
 */
const executeFunction = async ({ base_url, report_id_breakdowns }) => {
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  try {
    // Construct the URL for the API request
    const url = `${base_url}/${report_id_breakdowns}/insights`;

    // Set up headers for the request
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    // Perform the fetch request
    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    // Check if the response was successful
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching report ID breakdowns insights:', error);
    return { error: 'An error occurred while fetching insights.' };
  }
};

/**
 * Tool configuration for getting report ID breakdowns insights from the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_report_id_breakdowns_insights',
      description: 'Get insights for a specific report ID from the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          base_url: {
            type: 'string',
            description: 'The base URL for the Facebook Marketing API.'
          },
          report_id_breakdowns: {
            type: 'string',
            description: 'The report ID for which to get insights.'
          }
        },
        required: ['base_url', 'report_id_breakdowns']
      }
    }
  }
};

export { apiTool };