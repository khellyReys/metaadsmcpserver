/**
 * Enhanced MCP Tool: Create Ad Creative (supports existing posts + media)
 * Now supports boosting existing Facebook page posts via object_story_id
 */

const executeFunction = async ({
  // Required routing
  account_id,
  page_id,

  // Creative strategy - choose one approach
  creative_strategy = 'new_post', // 'new_post' | 'boost_existing'
  
  // For boosting existing posts
  post_id = null,              // Facebook post ID to boost
  object_story_id = null,      // Full object_story_id format (page_id_post_id)

  // For new post creation
  creative_type = 'photo',
  creative_name = null,
  message = null,

  // Media options (for new posts)
  image_hash = null,        
  video_id = null,          
  image_url = null,
  video_url = null,

  // Common options
  cta_type = 'LEARN_MORE'
}) => {
  const { createClient } = await import('@supabase/supabase-js');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const API_VERSION = process.env.FACEBOOK_API_VERSION || 'v21.0';
  const baseUrl = `https://graph.facebook.com/${API_VERSION}`;

  // Helper functions
  const clean = (obj) => {
    const o = { ...obj };
    Object.entries(o).forEach(([k, v]) => {
      if (v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)) {
        delete o[k];
      }
    });
    return o;
  };

  const getUserFromAccount = async (supabaseClient, accountId) => {
    if (!accountId) throw new Error('Account ID is required');
    const { data, error } = await supabaseClient
      .from('facebook_ad_accounts')
      .select('user_id, id')
      .eq('id', String(accountId).trim());
    if (error) throw new Error(`Account lookup failed: ${error.message}`);
    if (!data?.length) throw new Error(`Ad account ${accountId} not found in database.`);
    const row = data[0];
    if (!row.user_id) throw new Error(`Ad account ${accountId} has no associated user_id`);
    return row.user_id;
  };

  const getFacebookToken = async (supabaseClient, userId) => {
    const { data, error } = await supabaseClient
      .from('users')
      .select('facebook_long_lived_token')
      .eq('id', userId)
      .single();
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    return data?.facebook_long_lived_token || null;
  };

  // Validate existing post
  const validatePost = async ({ token, page_id, post_id }) => {
    const fullPostId = `${page_id}_${post_id}`;
    const endpoint = `${baseUrl}/${fullPostId}`;
    
    const resp = await fetch(`${endpoint}?access_token=${token}&fields=id,message,created_time,story,type,status_type,is_published`);
    const json = await resp.json();
    
    if (!resp.ok || json?.error) {
      throw new Error(`Post validation failed: ${json?.error?.message || 'Post not found or not accessible'}`);
    }

    if (!json.is_published) {
      throw new Error(`Post ${fullPostId} is not published and cannot be used for ads`);
    }

    return {
      id: json.id,
      message: json.message || json.story || '',
      type: json.type,
      created_time: json.created_time
    };
  };

  // Enhanced media upload with better error handling
  const uploadImageByUrl = async ({ token, account_id, url }) => {
    const endpoint = `${baseUrl}/act_${account_id}/adimages`;
    const form = new FormData();
    form.set('url', url);
    form.set('access_token', token);

    const resp = await fetch(endpoint, { method: 'POST', body: form });
    const json = await resp.json();
    
    if (!resp.ok || json?.error) {
      const msg = json?.error?.message || 'Unknown error';
      const code = json?.error?.code;
      
      if (code === 3 || msg.includes('does not have the capability')) {
        throw new Error(`Facebook app lacks ads_management permission. Please use pre-uploaded image_hash instead of image_url, or request Marketing API access for your app.`);
      }
      
      throw new Error(`Image upload failed: ${msg}`);
    }
    
    const first = Object.values(json.images || {})[0];
    if (!first?.hash) throw new Error('Image upload returned no hash');
    return first.hash;
  };

  const uploadVideoByUrl = async ({ token, account_id, url }) => {
    const endpoint = `${baseUrl}/act_${account_id}/advideos`;
    const form = new FormData();
    form.set('file_url', url);
    form.set('access_token', token);

    const resp = await fetch(endpoint, { method: 'POST', body: form });
    const json = await resp.json();
    
    if (!resp.ok || json?.error) {
      const msg = json?.error?.message || 'Unknown error';
      const code = json?.error?.code;
      
      if (code === 3 || msg.includes('does not have the capability')) {
        throw new Error(`Facebook app lacks ads_management permission. Please use pre-uploaded video_id instead of video_url, or request Marketing API access for your app.`);
      }
      
      throw new Error(`Video upload failed: ${msg}`);
    }
    
    if (!json.id) throw new Error('Video upload returned no ID');
    return json.id;
  };

  // Validation
  if (!account_id) return { error: 'Missing required parameter: account_id' };
  if (!page_id) return { error: 'Missing required parameter: page_id' };

  if (!['new_post', 'boost_existing'].includes(creative_strategy)) {
    return { error: "Invalid creative_strategy. Must be 'new_post' or 'boost_existing'" };
  }

  // Strategy-specific validation
  if (creative_strategy === 'boost_existing') {
    if (!post_id && !object_story_id) {
      return { error: "Strategy 'boost_existing' requires either post_id or object_story_id" };
    }
  }

  if (creative_strategy === 'new_post') {
    if (!message || !String(message).trim()) {
      return { error: "Strategy 'new_post' requires message parameter" };
    }
    
    if (!['photo', 'video'].includes(creative_type)) {
      return { error: "Invalid creative_type. Must be 'photo' or 'video'" };
    }

    if (creative_type === 'photo' && !image_hash && !image_url) {
      return { error: "New photo creative requires either image_hash or image_url" };
    }
    
    if (creative_type === 'video' && !video_id && !video_url) {
      return { error: "New video creative requires either video_id or video_url" };
    }
  }

  try {
    // Get token
    const userId = await getUserFromAccount(supabase, account_id);
    const token = await getFacebookToken(supabase, userId);
    if (!token) {
      return {
        error: 'No Facebook access token found for the user who owns this ad account',
        details: `Account ${account_id} belongs to user ${userId} but they have no Facebook token`
      };
    }

    let creativeName;
    let creativeParams;
    let postInfo = null;

    if (creative_strategy === 'boost_existing') {
      // Handle existing post boosting
      const finalObjectStoryId = object_story_id || `${page_id}_${post_id}`;
      
      // Validate the post exists and is accessible
      const actualPostId = post_id || finalObjectStoryId.split('_')[1];
      postInfo = await validatePost({ token, page_id, post_id: actualPostId });
      
      creativeName = creative_name || `Boost Post - ${actualPostId} - ${new Date().toISOString()}`;
      
      creativeParams = {
        name: creativeName,
        object_story_id: finalObjectStoryId,
        access_token: token
      };

    } else {
      // Handle new post creation
      let finalImageHash = image_hash;
      let finalVideoId = video_id;

      // Upload media if needed
      if (creative_type === 'photo' && !finalImageHash && image_url) {
        try {
          finalImageHash = await uploadImageByUrl({ token, account_id, url: image_url });
        } catch (uploadError) {
          return {
            error: uploadError.message,
            suggestion: "Consider uploading images manually via Facebook Ads Manager and using the image_hash parameter instead"
          };
        }
      }

      if (creative_type === 'video' && !finalVideoId && video_url) {
        try {
          finalVideoId = await uploadVideoByUrl({ token, account_id, url: video_url });
        } catch (uploadError) {
          return {
            error: uploadError.message,
            suggestion: "Consider uploading videos manually via Facebook Ads Manager and using the video_id parameter instead"
          };
        }
      }

      // Build object_story_spec for new posts
      const object_story_spec =
        creative_type === 'photo'
          ? {
              page_id,
              photo_data: clean({
                caption: String(message),
                image_hash: finalImageHash
              })
            }
          : {
              page_id,
              video_data: clean({
                video_id: finalVideoId,
                message: String(message)
              })
            };

      creativeName = creative_name || `New ${creative_type.toUpperCase()} Creative - ${new Date().toISOString()}`;
      
      creativeParams = {
        name: creativeName,
        object_story_spec: JSON.stringify(object_story_spec),
        access_token: token
      };
    }

    // Create the ad creative
    const endpoint = `${baseUrl}/act_${account_id}/adcreatives`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(creativeParams).toString()
    });
    
    const json = await resp.json();

    if (!resp.ok || json?.error) {
      return {
        error: `Ad creative creation failed: ${json?.error?.message || 'Unknown error'}`,
        details: json,
        facebook_error_code: json?.error?.code
      };
    }

    // Build success response
    const response = {
      success: true,
      creative: {
        id: json.id,
        name: creativeName,
        strategy: creative_strategy
      }
    };

    if (creative_strategy === 'boost_existing') {
      response.boosted_post = {
        object_story_id: creativeParams.object_story_id,
        post_info: postInfo
      };
    } else {
      response.creative.type = creative_type;
      response.media_info = creative_type === 'photo' 
        ? { image_hash: creativeParams.object_story_spec.includes('image_hash') ? JSON.parse(creativeParams.object_story_spec).photo_data.image_hash : null }
        : { video_id: creativeParams.object_story_spec.includes('video_id') ? JSON.parse(creativeParams.object_story_spec).video_data.video_id : null };
    }

    return response;

  } catch (error) {
    console.error('💥 Error in executeFunction (create-ad-creative):', error);
    return { 
      error: 'An error occurred while creating the ad creative.', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  }
};

// Updated schema to support both new posts and existing post boosting
const INPUT_SCHEMA = {
  type: 'object',
  properties: {
    account_id: { 
      type: 'string', 
      description: 'REQUIRED: Facebook ad account ID (no act_ prefix)' 
    },
    page_id: { 
      type: 'string', 
      description: 'REQUIRED: Facebook Page ID' 
    },

    creative_strategy: {
      type: 'string',
      enum: ['new_post', 'boost_existing'],
      default: 'new_post',
      description: 'Strategy: create new post or boost existing post'
    },

    // For boosting existing posts
    post_id: { 
      type: 'string', 
      description: 'For boost_existing: Facebook post ID (will be combined with page_id)' 
    },
    object_story_id: { 
      type: 'string', 
      description: 'For boost_existing: Full object_story_id format (page_id_post_id)' 
    },

    // For new post creation
    creative_type: {
      type: 'string',
      enum: ['photo', 'video'],
      default: 'photo',
      description: 'For new_post: Creative type (photo or video)'
    },
    creative_name: { 
      type: 'string', 
      description: 'Optional creative name; auto-generated if omitted' 
    },
    message: { 
      type: 'string', 
      description: 'For new_post: REQUIRED caption/message text' 
    },

    // Media options (for new posts only)
    image_hash: { 
      type: 'string', 
      description: 'For new_post photo: hash of pre-uploaded image (preferred)' 
    },
    video_id: { 
      type: 'string', 
      description: 'For new_post video: ID of pre-uploaded video (preferred)' 
    },
    image_url: { 
      type: 'string', 
      description: 'For new_post photo: publicly accessible image URL (fallback)' 
    },
    video_url: { 
      type: 'string', 
      description: 'For new_post video: publicly accessible video URL (fallback)' 
    },

    cta_type: {
      type: 'string',
      default: 'LEARN_MORE',
      description: 'Call-to-action type (reserved for future use)'
    }
  },
  required: ['account_id', 'page_id']
};

const apiTool = {
  function: executeFunction,
  definition: {
    name: 'create-ad-creative',
    description: 'Create Facebook Ad Creative - either boost existing page posts or create new photo/video posts. Supports both strategies with comprehensive error handling.',
    inputSchema: INPUT_SCHEMA,
    type: 'function',
    function: {
      name: 'create-ad-creative',
      description: 'Create Facebook Ad Creative - either boost existing page posts or create new photo/video posts. Supports both strategies with comprehensive error handling.',
      parameters: INPUT_SCHEMA
    }
  }
};

export { apiTool };