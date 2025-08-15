/**
 * Function to get campaign details from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the campaign details request.
 * @param {string} args.account_id - The ad account ID to fetch campaigns from.
 * @param {string} [args.base_url='https://graph.facebook.com/v18.0'] - The base URL for the Facebook Graph API.
 * @returns {Promise<Object>} - The details of the campaigns.
 */
const executeFunction = async ({ account_id, userId, base_url = 'https://graph.facebook.com/v18.0' }) => {

  const { createClient } = await import('@supabase/supabase-js');
  
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

  const getFacebookToken = async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('facebook_long_lived_token')
      .eq('id', userId)
      .single();

    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return data?.facebook_long_lived_token || null;
  };

  const token = await getFacebookToken(userId);
      if (!token) {
        return {
          error: 'No Facebook access token found for the user who owns this ad account',
          details: `Account ${account_id} belongs to user ${userId} but they have no Facebook token`,
        };
      }
  
  // Validate token exists
  if (!token) {
    throw new Error('FACEBOOK_MARKETING_API_API_KEY environment variable is not set');
  }
  
  if (!account_id) {
    throw new Error('account_id is required');
  }
  
  try {
    // Construct the URL for the request
    const url = `${base_url}/act_${account_id}/campaigns?fields=id,name,objective,account_id,buying_type,daily_budget,lifetime_budget,spend_cap,bid_strategy,pacing_type,status,effective_status,promoted_object,recommendations,start_time,stop_time,created_time,updated_time,adlabels,issues_info,special_ad_categories,special_ad_category_country,smart_promotion_type,is_skadnetwork_attribution`;


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
          throw new Error(`Facebook Permission Error (${error.code}): ${error.message}. Check your app permissions for account ${account_id}.`);
        } else if (error.code === 100) {
          throw new Error(`Facebook Parameter Error (${error.code}): ${error.message}. Check your account_id: ${account_id}.`);
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
      account_id: account_id,
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