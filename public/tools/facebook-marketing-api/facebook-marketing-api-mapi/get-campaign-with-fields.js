/**
 * Function to get campaign details from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the campaign retrieval.
 * @param {string} args.campaing_id_existing_ad - The ID of the existing campaign to retrieve.
 * @param {string} args.token - The access token for authorization.
 * @returns {Promise<Object>} - The details of the campaign.
 */
const executeFunction = async ({ campaing_id_existing_ad }) => {
  const baseUrl = ''; // will be provided by the user
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  try {
    // Construct the URL with query parameters
    const url = new URL(`${baseUrl}/`);
    url.searchParams.append('ids', campaing_id_existing_ad);
    url.searchParams.append('fields', 'id,account_id,objective,name,configured_status,effective_status,buying_type,created_time,updated_time,spend_cap,can_use_spend_cap,issues_info,special_ad_categories');

    // Set up headers for the request
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    // Perform the fetch request
    const response = await fetch(url.toString(), {
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
    console.error('Error retrieving campaign details:', error);
    return { error: 'An error occurred while retrieving campaign details.' };
  }
};

/**
 * Tool configuration for getting campaign details from the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetCampaignWithFields',
      description: 'Get details of a specific campaign from the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          campaing_id_existing_ad: {
            type: 'string',
            description: 'The ID of the existing campaign to retrieve.'
          }
        },
        required: ['campaing_id_existing_ad']
      }
    }
  }
};

export { apiTool };