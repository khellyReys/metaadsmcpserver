/**
 * Function to get offline conversion data sets for a specified ad account.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.account_id - The ID of the ad account.
 * @returns {Promise<Object>} - The result of the offline conversion data set retrieval.
 */
const executeFunction = async ({ account_id }) => {
  const baseUrl = ''; // will be provided by the user
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  try {
    // Construct the URL for the request
    const url = `${baseUrl}/act_${account_id}/offline_conversion_data_sets?fields=name,id,description,valid_entries,matched_entries,event_time_min,event_time_max,event_stats,business,is_assigned_to_ad_accounts_in_business,enable_auto_assign_to_accounts,auto_track_for_ads`;

    // Set up headers for the request
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    // Perform the fetch request
    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    // Check if the response was successful
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error retrieving offline conversion data sets:', JSON.stringify(errorData));
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error retrieving offline conversion data sets:', error);
    return { error: 'An error occurred while retrieving offline conversion data sets.' };
  }
};

/**
 * Tool configuration for retrieving offline conversion data sets for an ad account.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetOfflineConversionForAccountId',
      description: 'Get offline conversion data sets for a specified ad account.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the ad account.'
          }
        },
        required: ['account_id']
      }
    }
  }
};

export { apiTool };