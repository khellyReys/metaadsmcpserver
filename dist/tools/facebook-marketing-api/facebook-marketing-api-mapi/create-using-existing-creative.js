/**
 * Function to create an ad creative using the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for creating the ad creative.
 * @param {string} args.account_id - The ID of the ad account.
 * @param {string} args.object_story_id - The ID of the object story.
 * @param {string} args.page_id - The ID of the page.
 * @param {string} [args.name="postmanCreative"] - The name of the ad creative.
 * @returns {Promise<Object>} - The result of the ad creative creation.
 */
const executeFunction = async ({ account_id, object_story_id, page_id, name = 'postmanCreative' }) => {
  const baseUrl = ''; // will be provided by the user
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  
  try {
    // Construct the URL for the request
    const url = new URL(`${baseUrl}/act_${account_id}/adcreatives`);
    url.searchParams.append('name', name);
    url.searchParams.append('object_story_id', object_story_id);
    url.searchParams.append('page_id', page_id);

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
      console.error('Error creating ad creative:', JSON.stringify(errorData));
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating ad creative:', error);
    return { error: 'An error occurred while creating the ad creative.' };
  }
};

/**
 * Tool configuration for creating an ad creative using the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'CreateUsingExistingCreative',
      description: 'Create an ad creative using the Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the ad account.'
          },
          object_story_id: {
            type: 'string',
            description: 'The ID of the object story.'
          },
          page_id: {
            type: 'string',
            description: 'The ID of the page.'
          },
          name: {
            type: 'string',
            description: 'The name of the ad creative.'
          }
        },
        required: ['account_id', 'object_story_id', 'page_id']
      }
    }
  }
};

export { apiTool };