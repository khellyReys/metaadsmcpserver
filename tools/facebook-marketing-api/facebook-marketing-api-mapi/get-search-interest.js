/**
 * Function to search for interests on Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the search.
 * @param {string} args.type - The type of interest to search for (e.g., adinterest).
 * @param {string} args.q - The search query for interests.
 * @param {string} args.locale - The locale for the search.
 * @returns {Promise<Object>} - The result of the interest search.
 */
const executeFunction = async ({ type, q, locale }) => {
  const baseUrl = ''; // will be provided by the user
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  try {
    // Construct the URL with query parameters
    const url = new URL(`${baseUrl}/search`);
    url.searchParams.append('type', type);
    url.searchParams.append('q', q);
    url.searchParams.append('locale', locale);

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
      throw new Error(errorData);
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching for interests:', error);
    return { error: 'An error occurred while searching for interests.' };
  }
};

/**
 * Tool configuration for searching interests on Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetSearchInterest',
      description: 'Search for interests on Facebook Marketing API.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'The type of interest to search for.'
          },
          q: {
            type: 'string',
            description: 'The search query for interests.'
          },
          locale: {
            type: 'string',
            description: 'The locale for the search.'
          }
        },
        required: ['type', 'q', 'locale']
      }
    }
  }
};

export { apiTool };