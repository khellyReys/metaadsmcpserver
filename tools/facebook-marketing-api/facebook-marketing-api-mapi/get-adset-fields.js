/**
 * Function to get ad set fields from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the ad set fields retrieval.
 * @param {string} args.adset_id - The ID of the ad set to retrieve fields for.
 * @param {string} args.base_url - The base URL for the Facebook Marketing API.
 * @returns {Promise<Object>} - The result of the ad set fields retrieval.
 */
const executeFunction = async ({ adset_id, base_url }) => {
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  try {
    // Construct the URL for the request
    const url = `${base_url}/${adset_id}?fields=account_id,campaign_id,created_time,effective_status,id,name,recommendations,status`;

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
    console.error('Error retrieving ad set fields:', error);
    return { error: 'An error occurred while retrieving ad set fields.' };
  }
};

/**
 * Tool configuration for retrieving ad set fields from the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetAdsetFields',
      description: 'Retrieve fields for a specific ad set from the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          adset_id: {
            type: 'string',
            description: 'The ID of the ad set to retrieve fields for.'
          },
          base_url: {
            type: 'string',
            description: 'The base URL for the Facebook Marketing API.'
          }
        },
        required: ['adset_id', 'base_url']
      }
    }
  }
};

export { apiTool };