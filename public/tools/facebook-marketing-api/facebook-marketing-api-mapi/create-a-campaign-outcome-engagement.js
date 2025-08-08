/**
 * Function to create a campaign for engagement using the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for creating a campaign.
 * @param {string} args.account_id - The ID of the ad account to create the campaign under.
 * @param {string} args.name - The name of the campaign.
 * @param {string} [args.objective="OUTCOME_ENGAGEMENT"] - The objective of the campaign.
 * @param {string} [args.status="ACTIVE"] - The status of the campaign.
 * @param {Array} [args.special_ad_categories=[]] - Special ad categories for the campaign.
 * @returns {Promise<Object>} - The result of the campaign creation.
 */
const executeFunction = async ({ account_id, name, objective = 'OUTCOME_ENGAGEMENT', status = 'ACTIVE', special_ad_categories = [] }) => {
  const baseUrl = 'https://graph.facebook.com/v12.0'; // Update to the correct version if necessary
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  try {
    // Construct the URL for the campaign creation
    const url = `${baseUrl}/act_${account_id}/campaigns?name=${encodeURIComponent(name)}&objective=${encodeURIComponent(objective)}&status=${encodeURIComponent(status)}&special_ad_categories=${encodeURIComponent(JSON.stringify(special_ad_categories))}`;

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
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    return { error: 'An error occurred while creating the campaign.' };
  }
};

/**
 * Tool configuration for creating a campaign for engagement using the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'create_campaign_engagement',
      description: 'Create a campaign for engagement using the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the ad account to create the campaign under.'
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
          special_ad_categories: {
            type: 'array',
            description: 'Special ad categories for the campaign.'
          }
        },
        required: ['account_id', 'name']
      }
    }
  }
};

export { apiTool };