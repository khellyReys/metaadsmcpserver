/**
 * Function to get Instagram accounts associated with a Facebook Ad Account.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.account_id - The Facebook Ad Account ID.
 * @param {string} args.base_url - The base URL for the Facebook Marketing API.
 * @returns {Promise<Object>} - The result of the Instagram accounts retrieval.
 */
const executeFunction = async ({ account_id, base_url }) => {
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  try {
    // Construct the URL for the request
    const url = `${base_url}/act_${account_id}/instagram_accounts?fields=id,username,profile_pic`;

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
    console.error('Error retrieving Instagram accounts:', error);
    return { error: 'An error occurred while retrieving Instagram accounts.' };
  }
};

/**
 * Tool configuration for retrieving Instagram accounts from Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetIGAccounts',
      description: 'Retrieve Instagram accounts associated with a Facebook Ad Account.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The Facebook Ad Account ID.'
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