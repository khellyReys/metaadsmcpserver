/**
 * Function to get Ads Pixel statistics from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.pixel_id - The ID of the pixel for which to retrieve statistics.
 * @param {string} [args.base_url='https://graph.facebook.com/v12.0'] - The base URL for the Facebook Graph API.
 * @returns {Promise<Object>} - The statistics for the specified Ads Pixel.
 */
const executeFunction = async ({ pixel_id, base_url = 'https://graph.facebook.com/v12.0' }) => {
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  try {
    // Construct the URL for the request
    const url = `${base_url}/${pixel_id}/stats`;

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
    console.error('Error fetching Ads Pixel statistics:', error);
    return { error: 'An error occurred while fetching Ads Pixel statistics.' };
  }
};

/**
 * Tool configuration for getting Ads Pixel statistics from the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetAdsPixelStats',
      description: 'Retrieve statistics for a specified Ads Pixel.',
      parameters: {
        type: 'object',
        properties: {
          pixel_id: {
            type: 'string',
            description: 'The ID of the pixel for which to retrieve statistics.'
          },
          base_url: {
            type: 'string',
            description: 'The base URL for the Facebook Graph API.'
          }
        },
        required: ['pixel_id']
      }
    }
  }
};

export { apiTool };