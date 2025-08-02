/**
 * Function to get assigned users for a specified ad account in the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.account_id - The ID of the ad account.
 * @param {string} args.business_id - The ID of the business.
 * @param {string} [args.fields="id,tasks,user_type,permitted_tasks"] - The fields to retrieve for each user.
 * @returns {Promise<Object>} - The list of assigned users for the ad account.
 */
const executeFunction = async ({ account_id, business_id, fields = "id,tasks,user_type,permitted_tasks" }) => {
  const base_url = ''; // will be provided by the user
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  try {
    // Construct the URL with query parameters
    const url = new URL(`${base_url}/act_${account_id}/assigned_users`);
    url.searchParams.append('fields', fields);
    url.searchParams.append('business', business_id);

    // Set up headers for the request
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    // Perform the fetch request
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers
    });

    // Check if the response was successful
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error getting assigned users:', JSON.stringify(errorData));
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting assigned users:', error);
    return { error: 'An error occurred while getting assigned users.' };
  }
};

/**
 * Tool configuration for getting assigned users in the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetAssignedUsers',
      description: 'Get assigned users for a specified ad account in the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the ad account.'
          },
          business_id: {
            type: 'string',
            description: 'The ID of the business.'
          },
          fields: {
            type: 'string',
            description: 'The fields to retrieve for each user.'
          }
        },
        required: ['account_id', 'business_id']
      }
    }
  }
};

export { apiTool };