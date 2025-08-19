/**
 * Function to get campaign details from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the campaign details request.
 * @param {string} args.account_id - The ad account ID to fetch campaigns from.
 * @param {string} [args.base_url='https://graph.facebook.com/v18.0'] - The base URL for the Facebook Graph API.
 * @returns {Promise<Object>} - The details of the campaigns.
 */
const executeFunction = async ({ account_id, base_url = 'https://graph.facebook.com/v18.0' }) => {
  // Enhanced parameter validation
  if (!account_id || account_id === 'undefined' || account_id === 'null') {
    throw new Error('account_id is required and cannot be undefined or null');
  }
  
  if (typeof account_id !== 'string') {
    throw new Error('account_id must be a string');
  }
  
  // Trim and validate account_id format
  const cleanAccountId = account_id.trim();
  if (!cleanAccountId) {
    throw new Error('account_id cannot be empty or whitespace only');
  }
  
  // Remove 'act_' prefix if present to ensure consistent format
  const normalizedAccountId = cleanAccountId.replace(/^act_/, '');
  
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  
  // Validate token exists
  if (!token) {
    throw new Error('FACEBOOK_MARKETING_API_API_KEY environment variable is not set');
  }
  
  try {
    // Construct the URL for the request
    const url = `${base_url}/act_${normalizedAccountId}/campaigns?fields=id,name,objective,account_id,buying_type,daily_budget,lifetime_budget,spend_cap,bid_strategy,pacing_type,status,effective_status,promoted_object,recommendations,start_time,stop_time,created_time,updated_time,adlabels,issues_info,special_ad_categories,special_ad_category_country,smart_promotion_type,is_skadnetwork_attribution`;

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

    // Parse response data first
    const data = await response.json();

    // Check if the response was successful
    if (!response.ok) {
      console.error('Facebook API Error Response:', JSON.stringify(data, null, 2));
      
      // Handle Facebook API errors properly
      if (data.error) {
        const error = data.error;
        
        // Specific error handling for common Facebook API errors
        if (error.code === 190) {
          throw new Error(`Facebook OAuth Error (${error.code}): ${error.message}. Please refresh your access token.`);
        } else if (error.code === 200) {
          throw new Error(`Facebook Permission Error (${error.code}): ${error.message}. Check your app permissions for account ${normalizedAccountId}.`);
        } else if (error.code === 100) {
          throw new Error(`Facebook Parameter Error (${error.code}): ${error.message}. Check your account_id: ${normalizedAccountId}.`);
        } else {
          throw new Error(`Facebook API Error (${error.code}): ${error.message}`);
        }
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Handle successful response with Facebook API errors
    if (data.error) {
      const error = data.error;
      throw new Error(`Facebook API Error (${error.code}): ${error.message}`);
    }
    
    return {
      success: true,
      account_id: normalizedAccountId,
      campaigns: data.data || [],
      paging: data.paging || null,
      summary: data.summary || null
    };
    
  } catch (error) {
    console.error('Error fetching campaign details:', error.message);
    
    // Don't return error objects, throw them so MCP can handle properly
    throw new Error(`Failed to fetch campaign details: ${error.message}`);
  }
};

/**
 * Tool configuration for getting campaign details from the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetCampaignsDetails',
      description: 'Get details of campaigns from the specified ad account.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ad account ID to fetch campaigns from (without act_ prefix).'
          },
          base_url: {
            type: 'string',
            description: 'The base URL for the Facebook Graph API (default: https://graph.facebook.com/v18.0).',
            default: 'https://graph.facebook.com/v18.0'
          }
        },
        required: ['account_id']
      }
    }
  }
};

export { apiTool };