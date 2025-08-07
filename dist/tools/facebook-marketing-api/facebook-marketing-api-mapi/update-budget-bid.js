/**
 * Function to update the budget and bid strategy for a Facebook campaign.
 *
 * @param {Object} args - Arguments for updating the budget and bid.
 * @param {string} args.campaign_id_traffic_bid - The ID of the campaign to update.
 * @param {number} args.lifetime_budget - The lifetime budget for the campaign.
 * @param {string} args.bid_strategy - The bid strategy to use (e.g., "COST_CAP").
 * @param {string} [args.stop_time] - The time to stop the campaign (optional).
 * @returns {Promise<Object>} - The result of the update operation.
 */
const executeFunction = async ({ campaign_id_traffic_bid, lifetime_budget, bid_strategy, stop_time }) => {
  const baseUrl = ''; // will be provided by the user
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;

  try {
    // Construct the URL with query parameters
    const url = new URL(`${baseUrl}/${campaign_id_traffic_bid}`);
    url.searchParams.append('lifetime_budget', lifetime_budget.toString());
    url.searchParams.append('bid_strategy', bid_strategy);
    if (stop_time) {
      url.searchParams.append('stop_time', stop_time);
    }

    // Set up headers for the request
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Perform the fetch request
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers
    });

    // Check if the response was successful
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error updating budget and bid:', JSON.stringify(errorData));
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating budget and bid:', error);
    return { error: 'An error occurred while updating the budget and bid.' };
  }
};

/**
 * Tool configuration for updating budget and bid strategy for a Facebook campaign.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'UpdateBudgetBid',
      description: 'Update the budget and bid strategy for a Facebook campaign.',
      parameters: {
        type: 'object',
        properties: {
          campaign_id_traffic_bid: {
            type: 'string',
            description: 'The ID of the campaign to update.'
          },
          lifetime_budget: {
            type: 'number',
            description: 'The lifetime budget for the campaign.'
          },
          bid_strategy: {
            type: 'string',
            description: 'The bid strategy to use (e.g., "COST_CAP").'
          },
          stop_time: {
            type: 'string',
            description: 'The time to stop the campaign (optional).'
          }
        },
        required: ['campaign_id_traffic_bid', 'lifetime_budget', 'bid_strategy']
      }
    }
  }
};

export { apiTool };