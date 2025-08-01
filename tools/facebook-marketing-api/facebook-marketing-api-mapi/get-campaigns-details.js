/**
 * Function to get campaign details from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the campaign details request.
 * @param {string} args.account_id - The ad account ID to fetch campaigns from.
 * @param {string} [args.base_url='https://graph.facebook.com/v19.0'] - The base URL for the Facebook Graph API.
 * @returns {Promise<Object>} - The details of the campaigns.
 */
const executeFunction = async ({ account_id, base_url = 'https://graph.facebook.com/v19.0' }) => {
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  
  // Input validation
  if (!account_id) {
    const error = 'Missing required parameter: account_id';
    console.error('❌ Input validation error:', error);
    return { error, success: false };
  }

  if (!token) {
    const error = 'Missing Facebook access token. Check FACEBOOK_MARKETING_API_API_KEY environment variable.';
    console.error('❌ Authentication error:', error);
    return { error, success: false };
  }

  // Clean account ID (remove act_ prefix if present, we'll add it back)
  const cleanAccountId = account_id.replace(/^act_/, '');
  const fullAccountId = `act_${cleanAccountId}`;

  try {
    // Construct the URL for the request
    const fields = 'id,name,objective,account_id,buying_type,daily_budget,lifetime_budget,spend_cap,bid_strategy,pacing_type,status,effective_status,promoted_object,recommendations,start_time,stop_time,created_time,updated_time,adlabels,issues_info,special_ad_categories,special_ad_category_country,smart_promotion_type,is_skadnetwork_attribution';
    
    const url = `${base_url}/${fullAccountId}/campaigns?access_token=${token}&fields=${fields}`;
    
    // Log the request (with redacted token)
    console.log('🔄 Making Facebook API request:');
    console.log('  - Account ID:', fullAccountId);
    console.log('  - URL:', url.replace(token, '[REDACTED]'));
    console.log('  - Fields requested:', fields.split(',').length, 'fields');

    // Set up headers for the request
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'FacebookMarketingAPI/1.0'
    };

    // Perform the fetch request
    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    console.log('📡 Response received:');
    console.log('  - Status:', response.status, response.statusText);
    console.log('  - Headers:', Object.fromEntries(response.headers.entries()));

    // Parse response data first
    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      console.error('❌ Failed to parse response JSON:', parseError.message);
      console.error('  - Response status:', response.status);
      console.error('  - Response text preview:', await response.text().then(text => text.substring(0, 200)));
      throw new Error(`Invalid JSON response from Facebook API: ${parseError.message}`);
    }

    // Check if the response was successful
    if (!response.ok) {
      console.error('❌ Facebook API error response:');
      console.error('  - Status:', response.status, response.statusText);
      console.error('  - Error data:', JSON.stringify(responseData, null, 2));
      
      // Handle specific Facebook API errors
      if (responseData.error) {
        const fbError = responseData.error;
        console.error('📋 Facebook API Error Details:');
        console.error('  - Type:', fbError.type);
        console.error('  - Code:', fbError.code);
        console.error('  - Message:', fbError.message);
        console.error('  - Trace ID:', fbError.fbtrace_id);
        
        // Provide specific error guidance
        let errorGuidance = '';
        switch (fbError.code) {
          case 190:
            errorGuidance = 'Access token expired or invalid. Please refresh your token.';
            break;
          case 2500:
            errorGuidance = 'Invalid path or parameters. Check account ID and permissions.';
            break;
          case 100:
            errorGuidance = 'Invalid parameter. Check your request parameters.';
            break;
          case 200:
            errorGuidance = 'Insufficient permissions. Ensure your app has ads_read permission.';
            break;
          case 17:
            errorGuidance = 'Rate limit exceeded. Wait before making more requests.';
            break;
          default:
            errorGuidance = 'Check Facebook API documentation for error code details.';
        }
        
        console.error('💡 Suggested action:', errorGuidance);
        
        throw new Error(`Facebook API error (${fbError.code}): ${fbError.message}`);
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check for Facebook API error in successful response
    if (responseData.error) {
      console.error('❌ Facebook API returned error in successful response:', responseData.error);
      throw new Error(`Facebook API error: ${JSON.stringify(responseData.error)}`);
    }

    // Log success details
    console.log('✅ Successfully fetched campaign data:');
    console.log('  - Campaigns found:', responseData.data?.length || 0);
    console.log('  - Has paging:', !!responseData.paging);
    
    if (responseData.data?.length > 0) {
      console.log('  - Sample campaigns:');
      responseData.data.slice(0, 3).forEach((campaign, index) => {
        console.log(`    ${index + 1}. ${campaign.name} (${campaign.id}) - Status: ${campaign.status}`);
      });
    }

    // Return successful response with metadata
    return {
      success: true,
      data: responseData.data || [],
      paging: responseData.paging,
      summary: responseData.summary,
      total_count: responseData.data?.length || 0,
      account_id: fullAccountId
    };

  } catch (error) {
    // Enhanced error logging
    console.error('❌ Error fetching campaign details:');
    console.error('  - Error type:', error.constructor.name);
    console.error('  - Error message:', error.message);
    console.error('  - Stack trace:', error.stack);
    console.error('  - Account ID attempted:', fullAccountId);
    console.error('  - Base URL used:', base_url);
    console.error('  - Token present:', !!token);
    console.error('  - Token length:', token ? token.length : 0);
    
    // Check for common network errors
    if (error.message.includes('fetch')) {
      console.error('💡 This appears to be a network/fetch error. Check your internet connection.');
    }
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.error('💡 DNS or connection error. Check if graph.facebook.com is accessible.');
    }

    return {
      success: false,
      error: `Failed to fetch campaigns: ${error.message}`,
      error_type: error.constructor.name,
      account_id: fullAccountId,
      timestamp: new Date().toISOString()
    };
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
      description: 'Get details of campaigns from the specified ad account with comprehensive error logging.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ad account ID to fetch campaigns from (with or without act_ prefix).'
          },
          base_url: {
            type: 'string',
            description: 'The base URL for the Facebook Graph API (default: https://graph.facebook.com/v19.0).',
            default: 'https://graph.facebook.com/v19.0'
          }
        },
        required: ['account_id']
      }
    }
  }
};

// Helper function to test connection and list available accounts
const testConnection = async (base_url = 'https://graph.facebook.com/v19.0') => {
  const token = process.env.FACEBOOK_MARKETING_API_API_KEY;
  
  if (!token) {
    console.error('❌ No access token found');
    return { success: false, error: 'Missing access token' };
  }

  try {
    const url = `${base_url}/me/adaccounts?access_token=${token}&fields=id,name,account_status,currency`;
    console.log('🔍 Testing connection and listing accessible accounts...');
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.error('❌ Connection test failed:', data.error);
      return { success: false, error: data.error };
    }
    
    console.log('✅ Connection successful!');
    console.log(`📊 Found ${data.data?.length || 0} accessible ad accounts:`);
    
    if (data.data) {
      data.data.forEach((account, index) => {
        console.log(`  ${index + 1}. ${account.name}`);
        console.log(`     ID: ${account.id}`);
        console.log(`     Status: ${account.account_status}`);
        console.log(`     Currency: ${account.currency}`);
        console.log('');
      });
    }
    
    return { success: true, accounts: data.data };
    
  } catch (error) {
    console.error('❌ Connection test error:', error.message);
    return { success: false, error: error.message };
  }
};

export { apiTool, testConnection };