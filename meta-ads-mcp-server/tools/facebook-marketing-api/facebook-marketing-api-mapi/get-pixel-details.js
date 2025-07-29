/**
 * Function to get pixel details from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the pixel details request.
 * @param {string} args.account_id - The Ad Account ID to retrieve pixel details for.
 * @param {string} [args.base_url='https://graph.facebook.com/v12.0'] - The base URL for the Facebook Graph API.
 * @returns {Promise<Object>} - The result of the pixel details request.
 */
const executeFunction = async ({ account_id, base_url = 'https://graph.facebook.com/v12.0' }) => {
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  try {
    // Construct the URL for the request
    const url = `${base_url}/act_${account_id}/adspixels?fields=name,id,code,last_fired_time`;

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
    console.error('Error getting pixel details:', error);
    return { error: 'An error occurred while getting pixel details.' };
  }
};

/**
 * Tool configuration for getting pixel details from the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetPixelDetails',
      description: 'Get pixel details from the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The Ad Account ID to retrieve pixel details for.'
          },
          base_url: {
            type: 'string',
            description: 'The base URL for the Facebook Graph API.'
          }
        },
        required: ['account_id']
      }
    }
  }
};

export { apiTool };