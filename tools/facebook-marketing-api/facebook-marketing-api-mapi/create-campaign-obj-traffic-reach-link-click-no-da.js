/**
 * Function to create a campaign in the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for creating the campaign.
 * @param {string} args.account_id - The ad account ID to create the campaign in.
 * @param {string} args.token - The access token for authorization.
 * @param {string} [args.objective='OUTCOME_TRAFFIC'] - The objective of the campaign.
 * @param {string} [args.status='PAUSED'] - The status of the campaign.
 * @param {number} [args.lifetime_budget=500] - The lifetime budget for the campaign.
 * @param {string} [args.name='PostManCampaignOTReach2'] - The name of the campaign.
 * @param {string} [args.bid_strategy='LOWEST_COST_WITHOUT_CAP'] - The bidding strategy for the campaign.
 * @returns {Promise<Object>} - The result of the campaign creation.
 */
const executeFunction = async ({ account_id, token, objective = 'OUTCOME_TRAFFIC', status = 'PAUSED', lifetime_budget = 500, name = 'PostManCampaignOTReach2', bid_strategy = 'LOWEST_COST_WITHOUT_CAP' }) => {
  const baseUrl = 'https://graph.facebook.com/v12.0';
  const url = `${baseUrl}/act_${account_id}/campaigns?objective=${objective}&status=${status}&special_ad_categories=[]&optimization_goal=OFFSITE_CONVERSIONS&lifetime_budget=${lifetime_budget}&billing_event=LINK_CLICKS&targeting=targeting={ "geo_locations": {"countries":["US"]}, "interests": [{"id": 6003139266461, "name": "Movies"}]}&promoted_object&status=${status}&name=${name}&bid_strategy=${bid_strategy}&dynamic_creative_optimization_mode=OFF`;
  
  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
      method: 'POST',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData);
    }

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
      name: 'create_campaign',
      description: 'Create a campaign in the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ad account ID to create the campaign in.'
          },
          token: {
            type: 'string',
            description: 'The access token for authorization.'
          },
          objective: {
            type: 'string',
            description: 'The objective of the campaign.'
          },
          status: {
            type: 'string',
            description: 'The status of the campaign.'
          },
          lifetime_budget: {
            type: 'integer',
            description: 'The lifetime budget for the campaign.'
          },
          name: {
            type: 'string',
            description: 'The name of the campaign.'
          },
          bid_strategy: {
            type: 'string',
            description: 'The bidding strategy for the campaign.'
          }
        },
        required: ['account_id', 'token']
      }
    }
  }
};

export { apiTool };