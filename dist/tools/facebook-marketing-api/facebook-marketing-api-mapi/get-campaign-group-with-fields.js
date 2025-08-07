/**
 * Function to get campaign groups with specified fields from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the campaign group retrieval.
 * @param {string} args.campaign_id_traffic - The ID of the traffic campaign.
 * @param {string} args.campaign_id_awareness - The ID of the awareness campaign.
 * @param {string} args.campaign_id_sales - The ID of the sales campaign.
 * @returns {Promise<Object>} - The result of the campaign group retrieval.
 */
const executeFunction = async ({ campaign_id_traffic, campaign_id_awareness, campaign_id_sales }) => {
  const baseUrl = ''; // will be provided by the user
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  try {
    // Construct the URL with query parameters
    const url = new URL(`${baseUrl}/`);
    url.searchParams.append('ids', `${campaign_id_traffic},${campaign_id_awareness},${campaign_id_sales}`);
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
      console.error('Error retrieving campaign groups:', JSON.stringify(errorData));
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error retrieving campaign groups:', error);
    return { error: 'An error occurred while retrieving campaign groups.' };
  }
};

/**
 * Tool configuration for retrieving campaign groups from the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetCampaignGroupWithFields',
      description: 'Get campaign groups with specified fields from the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          campaign_id_traffic: {
            type: 'string',
            description: 'The ID of the traffic campaign.'
          },
          campaign_id_awareness: {
            type: 'string',
            description: 'The ID of the awareness campaign.'
          },
          campaign_id_sales: {
            type: 'string',
            description: 'The ID of the sales campaign.'
          }
        },
        required: ['campaign_id_traffic', 'campaign_id_awareness', 'campaign_id_sales']
      }
    }
  }
};

export { apiTool };