/**
 * Function to get ad set details for a specified ad account from the Facebook Marketing API.
 *
 * @param {Object} args - Arguments for the request.
 * @param {string} args.account_id - The ID of the ad account to retrieve ad set details for.
 * @param {string} args.token - The access token for authorization.
 * @param {number} [args.limit=300] - The maximum number of ad sets to return.
 * @returns {Promise<Object>} - The response containing ad set details.
 */
const executeFunction = async ({ account_id, token, limit = 300 }) => {
  const baseUrl = 'https://graph.facebook.com/v12.0'; // Facebook Marketing API base URL
  try {
    // Construct the URL with query parameters
    const url = new URL(`${baseUrl}/act_${account_id}/adsets`);
    url.searchParams.append('fields', 'optimization_goal,updated_time,billing_event,bid_strategy,lifetime_spend_cap,daily_spend_cap,learning_stage_info,effective_status,lifetime_min_spend_target,destination_type,bid_adjustments,bid_amount,id,daily_min_spend_target,campaign_id,pacing_type,created_time,attribution_spec,issues_info,lifetime_budget,creative_sequence,adset_schedule,end_time,daily_budget,is_dynamic_creative,start_time,account_id,adlabels,budget_remaining,promoted_object,name,bid_constraints,targeting{geo_locations,keywords,genders,age_min,age_max,relationship_statuses,countries,locales,device_platforms,effective_device_platforms,publisher_platforms,effective_publisher_platforms,facebook_positions,effective_facebook_positions,instagram_positions,effective_instagram_positions,audience_network_positions,effective_audience_network_positions,messenger_positions,effective_messenger_positions,education_statuses,user_adclusters,excluded_geo_locations,interested_in,interests,behaviors,connections,excluded_connections,friends_of_connections,user_os,user_device,excluded_user_device,app_install_state,wireless_carrier,site_category,college_years,work_employers,work_positions,education_majors,life_events,politics,income,home_type,home_value,ethnic_affinity,generation,household_composition,moms,office_type,family_statuses,net_worth,home_ownership,industries,education_schools,custom_audiences,excluded_custom_audiences,dynamic_audience_ids,product_audience_specs,excluded_product_audience_specs,flexible_spec,exclusions,excluded_publisher_categories,excluded_publisher_list_ids,place_page_set_ids,targeting_optimization,brand_safety_content_filter_levels,is_whatsapp_destination_ad,instream_video_skippable_excluded,targeting_relaxation_types');
    url.searchParams.append('limit', limit.toString());

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
    console.error('Error getting ad set details:', error);
    return { error: 'An error occurred while retrieving ad set details.' };
  }
};

/**
 * Tool configuration for getting ad set details from the Facebook Marketing API.
 * @type {Object}
 */
const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'GetAdsetDetailsForAccount',
      description: 'Get ad set details for a specified ad account.',
      parameters: {
        type: 'object',
        properties: {
          account_id: {
            type: 'string',
            description: 'The ID of the ad account to retrieve ad set details for.'
          },
          token: {
            type: 'string',
            description: 'The access token for authorization.'
          },
          limit: {
            type: 'integer',
            description: 'The maximum number of ad sets to return.'
          }
        },
        required: ['account_id', 'token']
      }
    }
  }
};

export { apiTool };