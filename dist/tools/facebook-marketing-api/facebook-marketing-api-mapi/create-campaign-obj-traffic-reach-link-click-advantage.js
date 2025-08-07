/**
 * Function to create a campaign in the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for creating the campaign.
 * @param {string} args.account_id - The Ad Account ID to create the campaign under.
 * @param {string} args.token - The access token for authorization.
 * @param {number} [args.daily_budget=500] - The daily budget for the campaign.
 * @param {string} [args.name='PostManCampaignOTReach2'] - The name of the campaign.
 * @param {string} [args.status='PAUSED'] - The status of the campaign.
 * @returns {Promise<Object>} - The result of the campaign creation.
 */
const executeFunction = async ({ account_id, token, daily_budget = 500, name = 'PostManCampaignOTReach2', status = 'PAUSED' }) => {
  const baseUrl = ''; // Base URL will be provided by the user
  const url = `${baseUrl}/act_${account_id}/campaigns?objective=OUTCOME_TRAFFIC&status=${status}&special_ad_categories=[]&optimization_goal=OFFSITE_CONVERSIONS&daily_budget=${daily_budget}&billing_event=LINK_CLICKS&targeting=targeting={ "geo_locations": {"countries":["US"]}, "interests": [{"id": 6003139266461, "name": "Movies"}]}&promoted_object&name=${name}&bid_strategy=LOWEST_COST_WITHOUT_CAP`;
  
  try {
    // Set up headers for the request
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Perform the fetch request
    const response = await fetch(url, {
      method: 'POST',
      headers
    });

    // Check if the response was successful
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error creating campaign:', JSON.stringify(errorData));
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating campaign:', error);
    return { error: 'An error occurred while creating the campaign.' };
  }
};

/**
 * Tool configuration for creating a campaign in the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'create_campaign_traffic_reach_link_click_advantage',
      description: 'Create a campaign in the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The Ad Account ID to create the campaign under.'
          },
          token: {
            type: 'string',
            description: 'The access token for authorization.'
          },
          daily_budget: {
            type: 'integer',
            description: 'The daily budget for the campaign.'
          },
          name: {
            type: 'string',
            description: 'The name of the campaign.'
          },
          status: {
            type: 'string',
            description: 'The status of the campaign.'
          }
        },
        required: ['account_id', 'token']
      }
    }
  }
};

export { apiTool };