/**
 * Function to get report for insight attribution from Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the report retrieval.
 * @param {string} args.amazon_report_attribution_id2 - The ID of the report attribution.
 * @param {string} args.base_url - The base URL for the API.
 * @returns {Promise<Object>} - The result of the report retrieval.
 */
const executeFunction = async ({ amazon_report_attribution_id2, base_url }) => {
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  try {
    // Construct the URL for the request
    const url = `${base_url}/${amazon_report_attribution_id2}/insights`;

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
    console.error('Error retrieving report for insight attribution:', error);
    return { error: 'An error occurred while retrieving the report.' };
  }
};

/**
 * Tool configuration for getting report for insight attribution from Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetReportForInsightAttribution',
      description: 'Get report for insight attribution from Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          amazon_report_attribution_id2: {
            type: 'string',
            description: 'The ID of the report attribution.'
          },
          base_url: {
            type: 'string',
            description: 'The base URL for the API.'
          }
        },
        required: ['amazon_report_attribution_id2', 'base_url']
      }
    }
  }
};

export { apiTool };