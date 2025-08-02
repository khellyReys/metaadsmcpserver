/**
 * Function to get the list of ad sets from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.account_id - The ID of the ad account to retrieve ad sets from.
 * @param {string} args.base_url - The base URL for the Facebook Marketing API.
 * @returns {Promise<Object>} - The list of ad sets or an error message.
 */
const executeFunction = async ({ account_id, base_url }) => {
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  try {
    // Construct the URL for the request
    const url = `${base_url}/act_${account_id}/adsets`;

    // Set up headers for the request
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
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
    console.error('Error retrieving ad sets:', error);
    return { error: 'An error occurred while retrieving ad sets.' };
  }
};

/**
 * Tool configuration for getting ad sets from the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetAdsetsList',
      description: 'Get a list of ad sets from the specified ad account.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the ad account to retrieve ad sets from.'
          },
          base_url: {
            type: 'string',
            description: 'The base URL for the Facebook Marketing API.'
          }
        },
        required: ['account_id', 'base_url']
      }
    }
  }
};

export { apiTool };