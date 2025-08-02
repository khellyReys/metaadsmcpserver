/**
 * Function to get creative details from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.adCreativeId - The ID of the ad creative to retrieve details for.
 * @returns {Promise<Object>} - The details of the ad creative.
 */
const executeFunction = async ({ adCreativeId }) => {
  const baseUrl = ''; // will be provided by the user
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  try {
    // Construct the URL for the request
    const url = `${baseUrl}/${adCreativeId}/?fields=name,object_story_id,object_story_spec{},object_type,image_hash,video_id,body,title,status`;

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
      console.error('Error getting creative details:', JSON.stringify(errorData));
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting creative details:', error);
    return { error: 'An error occurred while retrieving creative details.' };
  }
};

/**
 * Tool configuration for getting creative details from the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetCreativeDetails',
      description: 'Retrieve details of a specific ad creative.',
      parameters: {
        type: 'object',
        properties: {
          adCreativeId: {
            type: 'string',
            description: 'The ID of the ad creative to retrieve details for.'
          }
        },
        required: ['adCreativeId']
      }
    }
  }
};

export { apiTool };