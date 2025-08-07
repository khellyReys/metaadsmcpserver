/**
 * Function to create an ad set in the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for creating the ad set.
 * @param {string} args.account_id - The ad account ID.
 * @param {string} args.campaign_id - The campaign ID for the ad set.
 * @param {string} [args.name="PostMancAdsetTrafficCampaign"] - The name of the ad set.
 * @param {string} [args.billing_event="LINK_CLICKS"] - The billing event for the ad set.
 * @param {Object} args.targeting - The targeting options for the ad set.
 * @param {string} args.start_time - The start time for the ad set.
 * @param {string} [args.status="PAUSED"] - The status of the ad set.
 * @returns {Promise<Object>} - The result of the ad set creation.
 */
const executeFunction = async ({ account_id, campaign_id, name = "PostMancAdsetTrafficCampaign", billing_event = "LINK_CLICKS", targeting, start_time, status = "PAUSED" }) => {
  const baseUrl = ''; // will be provided by the user
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;

  try {
    const url = new URL(`${baseUrl}/act_${account_id}/adsets`);
    const params = new URLSearchParams({
      campaign_id,
      name,
      billing_event,
      targeting: JSON.stringify(targeting),
      start_time,
      status
    });

    // Set up headers for the request
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Perform the fetch request
    const response = await fetch(`${url}?${params}`, {
      method: 'POST',
      headers
    });

    // Check if the response was successful
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error creating ad set:', JSON.stringify(errorData));
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating ad set:', error);
    return { error: 'An error occurred while creating the ad set.' };
  }
};

/**
 * Tool configuration for creating an ad set in the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'CreateAdSetTrafficSpecialAdCredit',
      description: 'Create an ad set in the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ad account ID.'
          },
          campaign_id: {
            type: 'string',
            description: 'The campaign ID for the ad set.'
          },
          name: {
            type: 'string',
            description: 'The name of the ad set.'
          },
          billing_event: {
            type: 'string',
            description: 'The billing event for the ad set.'
          },
          targeting: {
            type: 'object',
            description: 'The targeting options for the ad set.'
          },
          start_time: {
            type: 'string',
            description: 'The start time for the ad set.'
          },
          status: {
            type: 'string',
            description: 'The status of the ad set.'
          }
        },
        required: ['account_id', 'campaign_id', 'targeting', 'start_time']
      }
    }
  }
};

export { apiTool };