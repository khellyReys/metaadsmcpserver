/**
 * Function to get campaign details from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the campaign details request.
 * @param {string} args.account_id - The ad account ID to fetch campaigns from.
 * @param {string} [args.base_url='https://graph.facebook.com/v18.0'] - The base URL for the Facebook Graph API.
 * @returns {Promise<Object>} - The details of the campaigns.
 */
const executeFunction = async ({ account_id, base_url }) => {
  // Get Facebook token from database instead of environment variable
  const { createClient } = await import('@supabase/supabase-js');
  
  // Create Supabase client only when function executes
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  // Helper function to get user ID from account ID (defined inside executeFunction)
  const getUserFromAccount = async (supabase, accountId) => {
    console.log('🔍 Finding user for account ID:', accountId);
    console.log('🔍 Account ID type:', typeof accountId, 'Value:', JSON.stringify(accountId));
    
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    try {
      // Convert to string to ensure type consistency
      const accountIdStr = String(accountId).trim();
      
      console.log('🔧 Searching for account ID (as string):', accountIdStr);
      
      // Query without .single() first to see what we get
      const { data: allData, error: allError, count } = await supabase
        .from('facebook_ad_accounts')
        .select('user_id, id, name', { count: 'exact' })
        .eq('id', accountIdStr);

      console.log('📊 Query results:', { 
        count, 
        allData, 
        allError, 
        searchedAccountId: accountIdStr 
      });

      if (allError) {
        console.error('❌ Account lookup error:', allError);
        throw new Error(`Account lookup failed: ${allError.message}`);
      }

      if (!allData || allData.length === 0) {
        console.warn('⚠️ No accounts found with ID:', accountIdStr);
        
        // Let's also try a broader search to see what accounts exist
        const { data: sampleData } = await supabase
          .from('facebook_ad_accounts')
          .select('id, name')
          .limit(5);
        
        console.log('📋 Sample accounts in database:', sampleData);
        
        throw new Error(`Ad account ${accountIdStr} not found in database. Check if the account ID is correct.`);
      }

      if (allData.length > 1) {
        console.warn('⚠️ Multiple accounts found with same ID:', allData);
        console.log('🔧 Using first account from duplicates');
      }

      const userData = allData[0];
      
      if (!userData.user_id) {
        throw new Error(`Account ${accountIdStr} found but has no associated user_id`);
      }
      
      console.log('✅ Found user ID:', userData.user_id, 'for account:', userData.name);
      return userData.user_id;
    } catch (error) {
      console.error('💥 Error in getUserFromAccount:', error);
      throw error;
    }
  };

  // Helper function to get Facebook token (defined inside executeFunction)
  const getFacebookToken = async (supabase, userId) => {
    console.log('🔍 Attempting to get Facebook token for userId:', userId);
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!supabase) {
      throw new Error('Supabase client is required');
    }

    try {
      console.log('📡 Making Supabase query...');
      const { data, error } = await supabase
        .from('users')
        .select('facebook_long_lived_token')
        .eq('id', userId)
        .single();

      console.log('📊 Supabase response:', { data, error });

      if (error) {
        console.error('❌ Supabase error:', error);
        throw new Error(`Supabase query failed: ${error.message}`);
      }

      if (!data) {
        console.warn('⚠️ No user found with ID:', userId);
        return null;
      }

      if (!data.facebook_long_lived_token) {
        console.warn('⚠️ User found but no Facebook token for user ID:', userId);
        return null;
      }

      console.log('✅ Facebook token retrieved successfully');
      return data.facebook_long_lived_token;
    } catch (error) {
      console.error('💥 Error in getFacebookToken:', error);
      throw error;
    }
  };

  // Simple parameter validation (adopting the less strict approach)
  if (!account_id) {
    throw new Error('account_id is required');
  }
  
  // Remove 'act_' prefix if present to ensure consistent format
  const normalizedAccountId = String(account_id).replace(/^act_/, '');
  
  try {
    console.log('🔍 Processing campaign details request for account:', normalizedAccountId);

    // Step 1: Find the user who owns this ad account
    const userId = await getUserFromAccount(supabase, normalizedAccountId);
    
    // Step 2: Get Facebook token for that user
    const token = await getFacebookToken(supabase, userId);
    
    if (!token) {
      throw new Error('No Facebook access token found for the user who owns this ad account');
    }

    // Construct the URL for the request using the passed account_id
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