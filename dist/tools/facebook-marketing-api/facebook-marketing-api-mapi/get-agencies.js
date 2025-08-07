/**
 * Function to get agencies associated with a Facebook Ad Account.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.account_id - The ID of the Facebook Ad Account.
 * @param {string} args.token - The Bearer token for authentication.
 * @returns {Promise<Array>} - The list of agencies associated with the Ad Account.
 */
const executeFunction = async ({ account_id }) => {
  const baseUrl = ''; // will be provided by the user
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  try {
    // Construct the URL for the request
    const url = `${baseUrl}/act_${account_id}/agencies?fields=permitted_tasks`;

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
      console.error('Error fetching agencies:', JSON.stringify(errorData));
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching agencies:', error);
    return { error: 'An error occurred while fetching agencies.' };
  }
};

/**
 * Tool configuration for getting agencies from Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetAgencies',
      description: 'Get agencies associated with a Facebook Ad Account.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the Facebook Ad Account.'
          }
        },
        required: ['account_id']
      }
    }
  }
};

export { apiTool };