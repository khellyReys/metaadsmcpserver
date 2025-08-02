/**
 * Function to create an ad set in the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for creating the ad set.
 * @param {string} args.account_id - The ad account ID.
 * @param {string} args.campaign_id - The campaign ID to associate with the ad set.
 * @param {string} args.token - The access token for authorization.
 * @param {string} [args.name="PostMancAdsetTrafficCampaignTargetIG"] - The name of the ad set.
 * @param {string} [args.billing_event="LINK_CLICKS"] - The billing event for the ad set.
 * @param {Object} [args.targeting] - The targeting options for the ad set.
 * @param {string} [args.start_time="2024-06-16T04:45:17+0000"] - The start time for the ad set.
 * @param {string} [args.status="PAUSED"] - The status of the ad set.
 * @returns {Promise<Object>} - The result of the ad set creation.
 */
const executeFunction = async ({ account_id, campaign_id, token, name = "PostMancAdsetTrafficCampaignTargetIG", billing_event = "LINK_CLICKS", targeting = { "age_max": 25, "age_min": 22, "geo_locations": { "countries": ["NP"], "location_types": ["home"] }, "genders": [1], "publisher_platforms": ["instagram"] }, start_time = "2024-06-16T04:45:17+0000", status = "PAUSED" }) => {
  const baseUrl = 'https://graph.facebook.com/v12.0';
  try {
    // Construct the URL for the request
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
      name: 'CreateAdSetTrafficTargetPlatform',
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
            description: 'The campaign ID to associate with the ad set.'
          },
          token: {
            type: 'string',
            description: 'The access token for authorization.'
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
        required: ['account_id', 'campaign_id', 'token']
      }
    }
  }
};

export { apiTool };