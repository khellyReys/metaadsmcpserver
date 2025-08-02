/**
 * Function to get the Ad Account details from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.account_id - The ID of the ad account to retrieve.
 * @param {string} args.base_url - The base URL for the Facebook API.
 * @returns {Promise<Object>} - The details of the ad account.
 */
const executeFunction = async ({ account_id, base_url }) => {
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  try {
    // Construct the URL for the request
    const url = `${base_url}/act_${account_id}`;

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
      console.error('Error fetching ad account details:', JSON.stringify(errorData));
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching ad account details:', error);
    return { error: 'An error occurred while fetching ad account details.' };
  }
};

/**
 * Tool configuration for getting Ad Account details from the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetAdAccount',
      description: 'Retrieve details of an ad account from the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the ad account to retrieve.'
          },
          base_url: {
            type: 'string',
            description: 'The base URL for the Facebook API.'
          }
        },
        required: ['account_id', 'base_url']
      }
    }
  }
};

export { apiTool };