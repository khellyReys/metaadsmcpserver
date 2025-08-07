/**
 * Function to get custom conversions for a specified ad account ID from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.account_id - The ID of the ad account to retrieve custom conversions for.
 * @param {string} args.token - The access token for authentication.
 * @returns {Promise<Object>} - The response from the Facebook Marketing API containing custom conversions.
 */
const executeFunction = async ({ account_id }) => {
  const baseUrl = 'https://graph.facebook.com/v12.0'; // Adjust version as needed
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  try {
    // Construct the URL for the API request
    const url = `${baseUrl}/act_${account_id}/customconversions?fields=account_id,creation_time,custom_event_type,default_conversion_value,description,data_sources,first_fired_time,is_archived,last_fired_time,name,pixel,rule,id`;

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
      console.error('Error fetching custom conversions:', JSON.stringify(errorData));
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching custom conversions:', error);
    return { error: 'An error occurred while fetching custom conversions.' };
  }
};

/**
 * Tool configuration for getting custom conversions from the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetCustomConversionforAccountId',
      description: 'Get custom conversions for a specified ad account ID.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the ad account to retrieve custom conversions for.'
          }
        },
        required: ['account_id']
      }
    }
  }
};

export { apiTool };