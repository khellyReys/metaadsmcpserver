/**
 * MCP Tool for creating a Facebook Ad Creative AND Ad (one-shot)
 * Supports LINK, VIDEO, and CAROUSEL creatives via object_story_spec
 *
 * Flow:
 *  1) Look up user for account_id -> fetch FB long-lived token from Supabase
 *  2) Build object_story_spec based on creative_type
 *  3) POST /act_<account_id>/adcreatives
 *  4) POST /act_<account_id>/ads with returned creative_id
 */

const executeFunction = async ({
    // 1) Routing / placement
    account_id,               // REQUIRED: ad account ID (no "act_" prefix)
    adset_id,                 // REQUIRED: target ad set ID
    ad_name = null,           // Default generated if not provided
    status = 'PAUSED',        // 'PAUSED'|'ACTIVE'|'ARCHIVED'|'DELETED'
  
    // 2) Actor (XOR)
    page_id = null,           // Facebook Page ID
    instagram_actor_id = null,// Instagram actor ID
  
    // 3) Creative shape
    creative_type = 'link',   // 'link' | 'video' | 'carousel'
    creative_name = null,     // Optional name for the creative
  
    // 4) Common creative fields
    message = null,           // Primary text / caption
    cta_type = null,          // e.g., 'SHOP_NOW', 'LEARN_MORE'
    cta_link_url = null,      // Destination for CTA
  
    // 5) LINK-specific
    link_url = null,          // Destination URL for link/video/carousel cards
    image_hash = null,        // From prior image upload
  
    // 6) VIDEO-specific
    video_id = null,          // From prior video upload
  
    // 7) CAROUSEL-specific
    child_attachments = []    // [{ name, description, link_url, image_hash?, video_id? }, ...] (2–10)
  }) => {
    // Only import and initialize Node-only dependencies at execution time
    const { createClient } = await import('@supabase/supabase-js');
  
    // Create Supabase client only when function executes
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  
    // ---- Helpers ----
    const API_VERSION = process.env.FACEBOOK_API_VERSION || 'v23.0';
    const baseUrl = `https://graph.facebook.com/${API_VERSION}`;
  
    const getUserFromAccount = async (supabaseClient, accountId) => {
      console.log('🔍 Finding user for account ID:', accountId);
      if (!accountId) throw new Error('Account ID is required');
  
      const accountIdStr = String(accountId).trim();
      const { data, error } = await supabaseClient
        .from('facebook_ad_accounts')
        .select('user_id, id, name')
        .eq('id', accountIdStr);
  
      if (error) throw new Error(`Account lookup failed: ${error.message}`);
      if (!data || data.length === 0)
        throw new Error(`Ad account ${accountIdStr} not found in database.`);
  
      const row = data[0];
      if (!row.user_id)
        throw new Error(`Account ${accountIdStr} found but has no associated user_id`);
      console.log('✅ Found user ID:', row.user_id, 'for account:', row.name);
      return row.user_id;
    };
  
    const getFacebookToken = async (supabaseClient, userId) => {
      console.log('🔑 Getting Facebook token for userId:', userId);
      const { data, error } = await supabaseClient
        .from('users')
        .select('facebook_long_lived_token')
        .eq('id', userId)
        .single();
      if (error) throw new Error(`Supabase query failed: ${error.message}`);
      return data?.facebook_long_lived_token || null;
    };
  
    const clean = (obj) => {
      const o = { ...obj };
      Object.entries(o).forEach(([k, v]) => {
        if (
          v == null ||
          (typeof v === 'string' && v.trim() === '') ||
          (Array.isArray(v) && v.length === 0)
        ) {
          delete o[k];
        }
      });
      return o;
    };
  
    const buildObjectStorySpec = ({
      actor, creative_type, message,
      cta_type, cta_link_url, link_url,
      image_hash, video_id, child_attachments
    }) => {
      const spec = { ...actor };
  
      if (creative_type === 'link') {
        const linkData = clean({
          link: link_url,
          message,
          image_hash,
          call_to_action: cta_type && cta_link_url ? {
            type: cta_type,
            value: { link: cta_link_url }
          } : undefined
        });
        spec.link_data = linkData;
      }
  
      if (creative_type === 'video') {
        const videoData = clean({
          video_id,
          message,
          link: link_url,
          call_to_action: cta_type && cta_link_url ? {
            type: cta_type,
            value: { link: cta_link_url }
          } : undefined
        });
        spec.video_data = videoData;
      }
  
      if (creative_type === 'carousel') {
        const carousel = {
          message,
          child_attachments: (child_attachments || []).map((card) => clean({
            name: card.name,
            description: card.description,
            link: card.link_url,
            image_hash: card.image_hash,
            video_id: card.video_id
          }))
        };
        // Optional whole-carousel CTA
        if (cta_type && cta_link_url) {
          carousel.call_to_action = {
            type: cta_type,
            value: { link: cta_link_url }
          };
        }
        spec.carousel_data = carousel;
      }
  
      return spec;
    };
  
    // ---- Validate required inputs ----
    if (!account_id) return { error: 'Missing required parameter: account_id' };
    if (!adset_id) return { error: 'Missing required parameter: adset_id' };
  
    const actorCount = [!!page_id, !!instagram_actor_id].filter(Boolean).length;
    if (actorCount !== 1) {
      return { error: 'Provide exactly one actor: page_id OR instagram_actor_id (not both).' };
    }
  
    if (!ad_name) {
      const today = new Date().toISOString().split('T')[0];
      console.log('ℹ️ No ad_name supplied; generating a default name.');
      ad_name = `Ad ${creative_type.toUpperCase()} ${today}`;
    }
  
    // creative-type specific validation
    if (creative_type === 'link') {
      if (!link_url) return { error: "creative_type 'link' requires link_url" };
      if (!image_hash)
        return { error: "creative_type 'link' requires image_hash (upload an image first to get image_hash)" };
    }
  
    if (creative_type === 'video') {
      if (!video_id) return { error: "creative_type 'video' requires video_id" };
      // link_url + CTA optional
    }
  
    if (creative_type === 'carousel') {
      if (!Array.isArray(child_attachments) || child_attachments.length < 2) {
        return { error: "creative_type 'carousel' requires child_attachments (2–10)" };
      }
      if (child_attachments.length > 10) {
        return { error: "creative_type 'carousel' supports at most 10 child_attachments" };
      }
      for (let i = 0; i < child_attachments.length; i++) {
        const ca = child_attachments[i];
        if (!ca.link_url) return { error: `Carousel card #${i + 1} missing link_url` };
        if (!ca.image_hash && !ca.video_id)
          return { error: `Carousel card #${i + 1} needs either image_hash or video_id` };
      }
    }
  
    console.log('📥 Input parameters received:', {
      account_id, adset_id, actor: page_id ? 'page_id' : 'instagram_actor_id', creative_type
    });
  
    try {
      // Step 1: Get user and token
      const userId = await getUserFromAccount(supabase, account_id);
      const token = await getFacebookToken(supabase, userId);
      if (!token) {
        return {
          error: 'No Facebook access token found for the user who owns this ad account',
          details: `Account ${account_id} belongs to user ${userId} but they have no Facebook token`
        };
      }
  
      // Step 2: Build object_story_spec
      const actor = page_id ? { page_id } : { instagram_actor_id };
      const object_story_spec = buildObjectStorySpec({
        actor,
        creative_type,
        message,
        cta_type,
        cta_link_url,
        link_url,
        image_hash,
        video_id,
        child_attachments
      });
  
      // Step 3: Create Creative
      const creativeUrl = `${baseUrl}/act_${account_id}/adcreatives`;
      const creativeParams = clean({
        name: creative_name,
        object_story_spec: JSON.stringify(object_story_spec),
        access_token: token
      });
      const creativeBody = new URLSearchParams(creativeParams);
  
      console.log('🧱 Creating Ad Creative at:', creativeUrl);
      const creativeResp = await fetch(creativeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: creativeBody.toString()
      });
  
      const creativeJson = await creativeResp.json();
      if (!creativeResp.ok || creativeJson?.error) {
        console.error('❌ Creative creation error:', creativeJson);
        return {
          error: `Ad creative creation failed: ${creativeJson?.error?.message || 'Unknown error'}`,
          details: creativeJson
        };
      }
  
      const creative_id = creativeJson?.id;
      if (!creative_id) {
        return { error: 'Creative creation succeeded but no creative_id was returned', details: creativeJson };
      }
      console.log('✅ Creative created:', creative_id);
  
      // Step 4: Create Ad referencing the Creative
      const adUrl = `${baseUrl}/act_${account_id}/ads`;
      const adParams = clean({
        name: ad_name,
        adset_id,
        status,
        creative: JSON.stringify({ creative_id }),
        access_token: token
      });
      const adBody = new URLSearchParams(adParams);
  
      console.log('🚀 Creating Ad at:', adUrl);
      const adResp = await fetch(adUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: adBody.toString()
      });
  
      const adJson = await adResp.json();
      if (!adResp.ok || adJson?.error) {
        console.error('❌ Ad creation error:', adJson);
        return {
          error: `Ad creation failed: ${adJson?.error?.message || 'Unknown error'}`,
          details: adJson
        };
      }
  
      console.log('✅ Ad created:', adJson);
  
      return {
        success: true,
        creative: {
          id: creative_id,
          object_story_spec
        },
        ad: {
          id: adJson?.id,
          name: ad_name,
          status,
          adset_id
        }
      };
    } catch (error) {
      console.error('💥 Error in executeFunction:', error);
      return {
        error: 'An error occurred while creating the ad creative and ad.',
        details: error.message
      };
    }
  };
  
  /**
   * Tool configuration for one-shot Ad Creative + Ad creation
   */
  const apiTool = {
    function: executeFunction,
    definition: {
      type: 'function',
      function: {
        name: 'create-ad-with-creative',
        description:
          'Create a Facebook Ad Creative and then the Ad in a single call. Supports LINK, VIDEO, and CAROUSEL object_story_spec.',
        parameters: {
          type: 'object',
          properties: {
            // 1) Routing / placement
            account_id: {
              type: 'string',
              description: 'REQUIRED: Facebook Ad Account ID (without act_ prefix)'
            },
            adset_id: {
              type: 'string',
              description: 'REQUIRED: Target Ad Set ID for the new ad'
            },
            ad_name: {
              type: 'string',
              description: 'Ad name (default auto-generated if omitted)'
            },
            status: {
              type: 'string',
              enum: ['PAUSED', 'ACTIVE', 'ARCHIVED', 'DELETED'],
              description: 'Initial ad status (default: PAUSED)'
            },
  
            // 2) Actor (exactly one required)
            page_id: {
              type: 'string',
              description: 'Facebook Page ID (mutually exclusive with instagram_actor_id)'
            },
            instagram_actor_id: {
              type: 'string',
              description: 'Instagram actor ID (mutually exclusive with page_id)'
            },
  
            // 3) Creative shape
            creative_type: {
              type: 'string',
              enum: ['link', 'video', 'carousel'],
              description: 'Creative format to build (default: link)'
            },
            creative_name: {
              type: 'string',
              description: 'Optional name for the Ad Creative'
            },
  
            // 4) Common creative fields
            message: { type: 'string', description: 'Primary text / caption' },
            cta_type: { type: 'string', description: 'Call-to-action type (e.g., SHOP_NOW, LEARN_MORE)' },
            cta_link_url: { type: 'string', description: 'CTA destination URL' },
  
            // 5) LINK-specific
            link_url: { type: 'string', description: 'Destination URL for link ads (also optional for video/cross-link)' },
            image_hash: {
              type: 'string',
              description: 'Image hash for link/carousel (obtain from image upload endpoint)'
            },
  
            // 6) VIDEO-specific
            video_id: { type: 'string', description: 'Uploaded video ID for video creatives' },
  
            // 7) CAROUSEL-specific
            child_attachments: {
              type: 'array',
              description: 'Cards for carousel (2–10). Each needs link_url and either image_hash or video_id.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Card headline' },
                  description: { type: 'string', description: 'Card description' },
                  link_url: { type: 'string', description: 'Card link URL' },
                  image_hash: { type: 'string', description: 'Card image hash (if image card)' },
                  video_id: { type: 'string', description: 'Card video id (if video card)' }
                },
                required: ['link_url']
              }
            }
          },
          required: ['account_id', 'adset_id', 'creative_type']
        }
      }
    }
  };
  
  export { apiTool };
  