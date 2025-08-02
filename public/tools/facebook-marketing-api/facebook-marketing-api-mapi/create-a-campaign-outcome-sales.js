/**
 * Function to create a campaign in the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for creating the campaign.
 * @param {string} args.account_id - The ad account ID to create the campaign in.
 * @param {string} args.token - The access token for authentication.
 * @param {string} [args.name="PostManCampaignOSImpression"] - The name of the campaign.
 * @param {string} [args.objective="OUTCOME_SALES"] - The objective of the campaign.
 * @param {string} [args.status="PAUSED"] - The status of the campaign.
 * @param {number} [args.lifetime_budget=100.00] - The lifetime budget for the campaign.
 * @param {string} [args.billing_event="IMPRESSIONS"] - The billing event for the campaign.
 * @param {string} [args.optimization_goal="IMPRESSIONS"] - The optimization goal for the campaign.
 * @param {string} [args.bid_strategy="LOWEST_COST_WITH_BID_CAP"] - The bid strategy for the campaign.
 * @returns {Promise<Object>} - The result of the campaign creation.
 */
const executeFunction = async ({ account_id, token, name = "PostManCampaignOSImpression", objective = "OUTCOME_SALES", status = "PAUSED", lifetime_budget = 100.00, billing_event = "IMPRESSIONS", optimization_goal = "IMPRESSIONS", bid_strategy = "LOWEST_COST_WITH_BID_CAP" }) => {
  const baseUrl = 'https://graph.facebook.com/v12.0';
  const campaignUrl = `${baseUrl}/act_${account_id}/campaigns`;
  
  const body = new URLSearchParams({
    name,
    objective,
    status,
    special_ad_categories: '[]',
    lifetime_budget: lifetime_budget.toString(),
    billing_event,
    optimization_goal,
    bid_strategy
  });

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  try {
    const response = await fetch(campaignUrl, {
      method: 'POST',
      headers,
      body
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error creating campaign:', JSON.stringify(errorData));
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
      name: 'CreateACampaignOutcomeSales',
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
            description: 'The access token for authentication.'
          },
          name: {
            type: 'string',
            description: 'The name of the campaign.'
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
            type: 'number',
            description: 'The lifetime budget for the campaign.'
          },
          billing_event: {
            type: 'string',
            description: 'The billing event for the campaign.'
          },
          optimization_goal: {
            type: 'string',
            description: 'The optimization goal for the campaign.'
          },
          bid_strategy: {
            type: 'string',
            description: 'The bid strategy for the campaign.'
          }
        },
        required: ['account_id', 'token']
      }
    }
  }
};

export { apiTool };