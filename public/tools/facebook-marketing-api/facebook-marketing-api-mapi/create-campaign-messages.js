// /**
//  * MCP Tool for creating Facebook campaigns for engagement/conversations
//  */

// /**
//  * Create a Facebook campaign for driving conversations/engagement
//  */
// const executeFunction = async ({ 
//   account_id, 
//   name,
//   objective, // Now required, no default value
//   status = 'ACTIVE',
//   special_ad_categories = ['NONE'],
//   buying_type = 'AUCTION',
//   bid_strategy = 'LOWEST_COST_WITHOUT_CAP',
//   daily_budget = 1000,
//   lifetime_budget = null,
//   campaign_budget_optimization = true
// }) => {
//   // Only import and initialize Node-only dependencies at execution time
//   const { createClient } = await import('@supabase/supabase-js');
  
//   // Create Supabase client only when function executes
//   const supabase = createClient(
//     process.env.SUPABASE_URL,
//     process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
//     {
//       auth: {
//         autoRefreshToken: false,
//         persistSession: false
//       }
//     }
//   );

//   // Helper function to get user ID from account ID (defined inside executeFunction)
//   const getUserFromAccount = async (supabase, accountId) => {
//     console.log('🔍 Finding user for account ID:', accountId);
//     console.log('🔍 Account ID type:', typeof accountId, 'Value:', JSON.stringify(accountId));
    
//     if (!accountId) {
//       throw new Error('Account ID is required');
//     }

//     try {
//       // Convert to string to ensure type consistency
//       const accountIdStr = String(accountId).trim();
      
//       console.log('🔧 Searching for account ID (as string):', accountIdStr);
      
//       // Query without .single() first to see what we get
//       const { data: allData, error: allError, count } = await supabase
//         .from('facebook_ad_accounts')
//         .select('user_id, id, name', { count: 'exact' })
//         .eq('id', accountIdStr);

//       console.log('📊 Query results:', { 
//         count, 
//         allData, 
//         allError, 
//         searchedAccountId: accountIdStr 
//       });

//       if (allError) {
//         console.error('❌ Account lookup error:', allError);
//         throw new Error(`Account lookup failed: ${allError.message}`);
//       }

//       if (!allData || allData.length === 0) {
//         console.warn('⚠️ No accounts found with ID:', accountIdStr);
        
//         // Let's also try a broader search to see what accounts exist
//         const { data: sampleData } = await supabase
//           .from('facebook_ad_accounts')
//           .select('id, name')
//           .limit(5);
        
//         console.log('📋 Sample accounts in database:', sampleData);
        
//         throw new Error(`Ad account ${accountIdStr} not found in database. Check if the account ID is correct.`);
//       }

//       if (allData.length > 1) {
//         console.warn('⚠️ Multiple accounts found with same ID:', allData);
//         console.log('🔧 Using first account from duplicates');
//       }

//       const userData = allData[0];
      
//       if (!userData.user_id) {
//         throw new Error(`Account ${accountIdStr} found but has no associated user_id`);
//       }
      
//       console.log('✅ Found user ID:', userData.user_id, 'for account:', userData.name);
//       return userData.user_id;
//     } catch (error) {
//       console.error('💥 Error in getUserFromAccount:', error);
//       throw error;
//     }
//   };

//   // Helper function to get Facebook token (defined inside executeFunction)
//   const getFacebookToken = async (supabase, userId) => {
//     console.log('🔍 Attempting to get Facebook token for userId:', userId);
    
//     if (!userId) {
//       throw new Error('User ID is required');
//     }

//     if (!supabase) {
//       throw new Error('Supabase client is required');
//     }

//     try {
//       console.log('📡 Making Supabase query...');
//       const { data, error } = await supabase
//         .from('users')
//         .select('facebook_long_lived_token')
//         .eq('id', userId)
//         .single();

//       console.log('📊 Supabase response:', { data, error });

//       if (error) {
//         console.error('❌ Supabase error:', error);
//         throw new Error(`Supabase query failed: ${error.message}`);
//       }

//       if (!data) {
//         console.warn('⚠️ No user found with ID:', userId);
//         return null;
//       }

//       if (!data.facebook_long_lived_token) {
//         console.warn('⚠️ User found but no Facebook token for user ID:', userId);
//         return null;
//       }

//       console.log('✅ Facebook token retrieved successfully');
//       return data.facebook_long_lived_token;
//     } catch (error) {
//       console.error('💥 Error in getFacebookToken:', error);
//       throw error;
//     }
//   };

//   // Now execute the main function logic
//   const API_VERSION = process.env.FACEBOOK_API_VERSION || 'v23.0';
//   const baseUrl = `https://graph.facebook.com/${API_VERSION}`;
  
//   // Validate required params
//   if (!account_id) {
//     return { 
//       error: 'Missing required parameter: account_id' 
//     };
//   }

//   if (!objective) {
//     return { 
//       error: 'Missing required parameter: objective. Please choose from: OUTCOME_ENGAGEMENT, OUTCOME_LEADS, OUTCOME_SALES, OUTCOME_AWARENESS, OUTCOME_TRAFFIC, OUTCOME_APP_PROMOTION' 
//     };
//   }

//   // Validate objective is one of the allowed values
//   const validObjectives = [
//     'OUTCOME_ENGAGEMENT', 
//     'OUTCOME_LEADS', 
//     'OUTCOME_SALES', 
//     'OUTCOME_AWARENESS', 
//     'OUTCOME_TRAFFIC', 
//     'OUTCOME_APP_PROMOTION'
//   ];
  
//   if (!validObjectives.includes(objective)) {
//     return {
//       error: `Invalid objective: ${objective}. Must be one of: ${validObjectives.join(', ')}`
//     };
//   }

//   // Normalize the objective (trim whitespace)
//   const normalizedObjective = objective.trim();

//   if (campaign_budget_optimization === true) {
//     const hasLifetime = Number(lifetime_budget) > 0;
//     const hasDaily = Number(daily_budget) > 0;
  
//     if (!hasLifetime && !hasDaily) {
//       return {
//         error: 'Validation error: When campaign_budget_optimization is true, you must provide either lifetime_budget or daily_budget (> 0).',
//         details: { campaign_budget_optimization, daily_budget, lifetime_budget }
//       };
//     }
//   }

//   // Debug input parameters
//   console.log('📥 Input parameters received:', {
//     account_id,
//     objective: normalizedObjective,
//     special_ad_categories: {
//       value: special_ad_categories,
//       type: typeof special_ad_categories,
//       isArray: Array.isArray(special_ad_categories),
//       length: Array.isArray(special_ad_categories) ? special_ad_categories.length : 'N/A'
//     }
//   });

//   try {
//     console.log('🔍 Processing campaign creation for account:', account_id);

//     // Step 1: Find the user who owns this ad account
//     const userId = await getUserFromAccount(supabase, account_id);
    
//     // Step 2: Get Facebook token for that user
//     const token = await getFacebookToken(supabase, userId);
    
//     if (!token) {
//       return { 
//         error: 'No Facebook access token found for the user who owns this ad account',
//         details: `Account ${account_id} belongs to user ${userId} but they have no Facebook token`
//       };
//     }

//     // Generate campaign name with timestamp if not provided
//     const campaignName = name || `Campaign ${normalizedObjective} ${new Date().toISOString()}`;
    
//     // Calculate stop_time (7 days from now)
//     const stopTime = new Date();
//     stopTime.setDate(stopTime.getDate() + 7);

//     const url = `${baseUrl}/act_${account_id}/campaigns`;
    
//     // Log the parameters for debugging
//     console.log('📋 Campaign parameters before processing:', {
//       objective: normalizedObjective,
//       special_ad_categories,
//       type: typeof special_ad_categories,
//       isArray: Array.isArray(special_ad_categories)
//     });

//     const campaignParams = {
//       name: campaignName,
//       objective: normalizedObjective, // Now uses the properly validated and normalized objective
//       status,
//       buying_type,
//       stop_time: stopTime.toISOString(),
//       access_token: token
//     };

//     // Handle special_ad_categories - try different approaches based on client behavior
//     const specialAdCategoriesForApi =
//     Array.isArray(special_ad_categories) && special_ad_categories.length > 0
//       ? JSON.stringify(special_ad_categories)
//       : JSON.stringify(['NONE']);
//   campaignParams.special_ad_categories = specialAdCategoriesForApi;

//     // Campaign Budget Optimization (CBO) Logic
//     if (campaign_budget_optimization) {
//       campaignParams.bid_strategy = bid_strategy;
//       if (lifetime_budget && Number(lifetime_budget) > 0) {
//         campaignParams.lifetime_budget = String(lifetime_budget);
//       } else if (daily_budget && Number(daily_budget) > 0) {
//         campaignParams.daily_budget = String(daily_budget);
//       }
//     } else {
//       // CBO disabled: No budget at campaign level (budgets will be set at ad set level)
//       console.log('📊 Campaign Budget Optimization disabled - budgets will be set at ad set level');
//       console.log('⚠️ Note: You must set budgets when creating ad sets for this campaign');
//     }

//     // Remove null/empty values
//     for (const [k, v] of Object.entries(campaignParams)) {
//       if (v == null || (typeof v === 'string' && v.trim() === '')) {
//         delete campaignParams[k];
//       }
//     }

//     const body = new URLSearchParams(campaignParams);

//     console.log('🚀 Making Facebook API request to:', url);
//     console.log('📋 Final campaign params being sent:', Object.fromEntries(body.entries()));

//     const response = await fetch(url, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/x-www-form-urlencoded'
//       },
//       body: body.toString()
//     });

//     if (!response.ok) {
//       const errorData = await response.json();
//       console.error('❌ Facebook API error:', errorData);
//       return { 
//         error: `Campaign creation failed: ${errorData.error?.message || 'Unknown error'}`,
//         details: errorData 
//       };
//     }

//     const result = await response.json();
//     console.log('✅ Campaign created successfully:', result);
    
//     return {
//       success: true,
//       campaign: result,
//       account_id,
//       objective_used: normalizedObjective,
//       budget_optimization: {
//         cbo_enabled: campaign_budget_optimization,
//         budget_level: campaign_budget_optimization ? 'campaign' : 'ad_set',
//         budget_type: lifetime_budget && campaign_budget_optimization ? 'lifetime' : 'daily',
//         budget_amount: campaign_budget_optimization ? (lifetime_budget || daily_budget) : null
//       },
//     };
//   } catch (error) {
//     console.error('💥 Error in executeFunction:', error);
//     return { 
//       error: 'An error occurred while creating the campaign.',
//       details: error.message 
//     };
//   }
// };

// /**
//  * Tool configuration for creating Facebook engagement campaigns
//  * Definition is kept pure with no Node-only dependencies
//  */
// const apiTool = {
//   function: executeFunction,
//   definition: {
//     type: 'function',
//     function: {
//       name: 'create-campaign-messages',
//       description: 'Create a Facebook campaign with the specified objective. Choose the appropriate objective based on your campaign goals.',
//       parameters: {
//         type: 'object',
//         properties: {
//           account_id: {
//             type: 'string',
//             description: 'Facebook ad account ID (without act_ prefix) - automatically provided from MCP context'
//           },
//           objective: {
//             type: 'string',
//             enum: [
//               'OUTCOME_ENGAGEMENT', 
//               'OUTCOME_LEADS', 
//               'OUTCOME_SALES', 
//               'OUTCOME_AWARENESS', 
//               'OUTCOME_TRAFFIC', 
//               'OUTCOME_APP_PROMOTION'
//             ],
//             description: 'REQUIRED: Campaign objective. OUTCOME_ENGAGEMENT for messages/conversations, OUTCOME_LEADS for lead generation, OUTCOME_SALES for conversions, OUTCOME_AWARENESS for brand awareness, OUTCOME_TRAFFIC for website visits, OUTCOME_APP_PROMOTION for app installs/engagement'
//           },
//           name: {
//             type: 'string',
//             description: 'Campaign name (defaults to "Campaign {objective} {timestamp}")'
//           },
//           status: {
//             type: 'string',
//             enum: ['ACTIVE', 'PAUSED'],
//             description: 'Campaign status (default: ACTIVE)'
//           },
//           special_ad_categories: {
//             type: 'array',
//             items: {
//               type: 'string',
//               enum: ['NONE', 'EMPLOYMENT', 'HOUSING', 'CREDIT', 'ISSUES_ELECTIONS_POLITICS', 'ONLINE_GAMBLING_AND_GAMING', 'FINANCIAL_PRODUCTS_SERVICES']
//             },
//             description: 'Special ad categories (default: ["NONE"])'
//           },
//           buying_type: {
//             type: 'string',
//             enum: ['AUCTION', 'RESERVED'],
//             description: 'Buying type (default: AUCTION)'
//           },
//           bid_strategy: {
//             type: 'string',
//             enum: ['LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP', 'COST_CAP', 'LOWEST_COST_WITH_MIN_ROAS'],
//             description: 'Bid strategy (default: LOWEST_COST_WITHOUT_CAP)'
//           },
//           daily_budget: {
//             type: 'integer',
//             description: 'Daily budget in cents (default: 1000 = $10/day). Used when campaign_budget_optimization is true and no lifetime_budget is set.'
//           },
//           lifetime_budget: {
//             type: 'integer',
//             description: 'Lifetime budget in cents. If set and campaign_budget_optimization is true, this overrides daily_budget.'
//           },
//           campaign_budget_optimization: {
//             type: 'boolean',
//             description: 'Enable Campaign Budget Optimization (CBO). When true, budget is set at campaign level and Facebook optimizes distribution across ad sets. When false, budgets must be set at ad set level. (default: true)'
//           }
//         },
//         required: ['account_id', 'objective']
//       }
//     }
//   }
// };

// export { apiTool };