/**
 * Function to get ads from a specified Facebook Ad Account.
 *
 * @param {Object} args - Arguments for the ad retrieval.
 * @param {string} args.account_id - The ID of the ad account to retrieve ads from.
 * @param {string} args.token - The access token for authentication.
 * @returns {Promise<Object>} - The result of the ad retrieval.
 */
const executeFunction = async ({ account_id }) => {
  const base_url = 'https://graph.facebook.com/v12.0'; // Facebook Graph API base URL
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;

  try {
    // Construct the URL for the API request
    const url = `${base_url}/act_${account_id}/ads?fields=id,name,bid_amount,adset_id,creative{effective_instagram_story_id,effective_instagram_media_id,instagram_permalink_url},status,effective_status,created_time,updated_time,tracking_specs,conversion_specs,ad_review_feedback,adlabels,issues_info,conversion_domain,campaign_id`;

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
      console.error('Error retrieving ads:', JSON.stringify(errorData));
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error retrieving ads:', error);
    return { error: 'An error occurred while retrieving ads.' };
  }
};

/**
 * Tool configuration for retrieving ads from a Facebook Ad Account.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetAdsFromAccountIdWithFields',
      description: 'Retrieve ads from a specified Facebook Ad Account.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the ad account to retrieve ads from.'
          }
        },
        required: ['account_id']
      }
    }
  }
};

export { apiTool };