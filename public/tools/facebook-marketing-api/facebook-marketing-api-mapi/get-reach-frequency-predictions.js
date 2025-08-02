/**
 * Function to get reach frequency predictions from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.account_id - The ad account ID.
 * @param {string} args.token - The access token for authentication.
 * @param {string} [args.base_url='https://graph.facebook.com/v12.0'] - The base URL for the Facebook API.
 * @returns {Promise<Object>} - The response from the API containing reach frequency predictions.
 */
const executeFunction = async ({ account_id, token, base_url = 'https://graph.facebook.com/v12.0' }) => {
  const url = `${base_url}/act_${account_id}/reachfrequencypredictions?fields=external_maximum_impression,external_budget,time_updated,pause_periods,audience_size_lower_bound,external_maximum_budget,prediction_mode,external_maximum_reach,holdout_percentage,prediction_progress,target_spec,id,story_event_type,audience_size_upper_bound,external_minimum_reach,reservation_status,time_created,external_impression,external_minimum_impression,expiration_time,external_minimum_budget,account_id,interval_frequency_cap_reset_period,campaign_time_stop,destination_id,status,external_reach,frequency_cap,campaign_group_id,campaign_id,campaign_time_start,instagram_destination_id,name`;

  try {
    // Set up headers for the request
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Perform the fetch request
    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    // Check if the response was successful
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error fetching reach frequency predictions:', JSON.stringify(errorData));
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching reach frequency predictions:', error);
    return { error: 'An error occurred while fetching reach frequency predictions.' };
  }
};

/**
 * Tool configuration for getting reach frequency predictions from the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetReachFrequencyPredictions',
      description: 'Get reach frequency predictions for a specific ad account.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ad account ID.'
          },
          token: {
            type: 'string',
            description: 'The access token for authentication.'
          },
          base_url: {
            type: 'string',
            description: 'The base URL for the Facebook API.'
          }
        },
        required: ['account_id', 'token']
      }
    }
  }
};

export { apiTool };