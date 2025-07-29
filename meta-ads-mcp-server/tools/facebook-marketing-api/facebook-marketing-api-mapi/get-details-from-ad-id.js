/**
 * Function to get details from an Ad ID using the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.ad_id - The ID of the ad to retrieve details for.
 * @param {string} args.base_url - The base URL for the Facebook Marketing API.
 * @returns {Promise<Object>} - The details of the ad.
 */
const executeFunction = async ({ ad_id, base_url }) => {
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  try {
    // Construct the URL for the request
    const url = `${base_url}/${ad_id}/?fields=account_id,adset_id,bid_amount,campaign_id,configured_status,conversion_specs,created_time,creative,display_sequence,effective_status,id,last_updated_by_app_id,name,priority,recommendations,source_ad_id,status,targeting,tracking_specs,updated_time`;

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
    console.error('Error getting ad details:', error);
    return { error: 'An error occurred while retrieving ad details.' };
  }
};

/**
 * Tool configuration for getting details from an Ad ID using the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetDetailsFromAdID',
      description: 'Get details from an Ad ID using the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          ad_id: {
            type: 'string',
            description: 'The ID of the ad to retrieve details for.'
          },
          base_url: {
            type: 'string',
            description: 'The base URL for the Facebook Marketing API.'
          }
        },
        required: ['ad_id', 'base_url']
      }
    }
  }
};

export { apiTool };