/**
 * Function to update the name and status of an ad in the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for updating the ad.
 * @param {string} args.ad_id_awareness - The ID of the ad to be updated.
 * @param {string} [args.name="PostManAdTrafficUpdate"] - The new name for the ad.
 * @param {string} [args.status="PAUSED"] - The new status for the ad.
 * @returns {Promise<Object>} - The result of the ad update operation.
 */
const executeFunction = async ({ ad_id_awareness, name = "PostManAdTrafficUpdate", status = "PAUSED" }) => {
  const baseUrl = ''; // will be provided by the user
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  try {
    // Construct the URL for the request
    const url = `${baseUrl}/${ad_id_awareness}?name=${encodeURIComponent(name)}&status=${encodeURIComponent(status)}`;

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
    console.error('Error updating ad name and status:', error);
    return { error: 'An error occurred while updating the ad.' };
  }
};

/**
 * Tool configuration for updating an ad's name and status in the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'UpdateAdNameStatus',
      description: 'Update the name and status of an ad in the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          ad_id_awareness: {
            type: 'string',
            description: 'The ID of the ad to be updated.'
          },
          name: {
            type: 'string',
            description: 'The new name for the ad.'
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'PAUSED', 'ARCHIVED'],
            description: 'The new status for the ad.'
          }
        },
        required: ['ad_id_awareness']
      }
    }
  }
};

export { apiTool };