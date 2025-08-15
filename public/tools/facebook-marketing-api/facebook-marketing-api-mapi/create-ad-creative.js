/**
 * MCP Tool: Create Ad Creative (LINK, VIDEO, CAROUSEL)
 * - Builds object_story_spec
 * - POST /act_<account_id>/adcreatives
 */

const executeFunction = async ({
  // Routing
  account_id,                 // REQUIRED: ad account id (no "act_" prefix)

  // Actor (XOR)
  page_id = null,             // Facebook Page ID
  instagram_actor_id = null,  // Instagram actor ID

  // Creative shape
  creative_type = 'link',     // 'link' | 'video' | 'carousel'
  creative_name = null,       // Optional name

  // Common fields
  message = null,
  cta_type = null,
  cta_link_url = null,

  // LINK
  link_url = null,
  image_hash = null,

  // VIDEO
  video_id = null,

  // CAROUSEL
  child_attachments = []      // [{ name, description, link_url, image_hash?, video_id? }, ...] (2–10)
}) => {
  const { createClient } = await import('@supabase/supabase-js');

  // Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const API_VERSION = process.env.FACEBOOK_API_VERSION || 'v23.0';
  const baseUrl = `https://graph.facebook.com/${API_VERSION}`;

  // ----- Helpers -----
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
    console.log('🔍 Finding user for account ID:', accountId);
    if (!accountId) throw new Error('Account ID is required');
    const accountIdStr = String(accountId).trim();
    const { data, error } = await supabaseClient
      .from('facebook_ad_accounts')
      .select('user_id, id, name')
      .eq('id', accountIdStr);
    if (error) throw new Error(`Account lookup failed: ${error.message}`);
    if (!data || data.length === 0) throw new Error(`Ad account ${accountIdStr} not found in database.`);
    const row = data[0];
    if (!row.user_id) throw new Error(`Account ${accountIdStr} found but has no associated user_id`);
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
        call_to_action: cta_type && cta_link_url
          ? { type: cta_type, value: { link: cta_link_url } }
          : undefined
      });
      spec.link_data = linkData;
    }

    if (creative_type === 'video') {
      const videoData = clean({
        video_id,
        message,
        link: link_url,
        call_to_action: cta_type && cta_link_url
          ? { type: cta_type, value: { link: cta_link_url } }
          : undefined
      });
      spec.video_data = videoData;
    }

    if (creative_type === 'carousel') {
      const cards = Array.isArray(child_attachments) ? child_attachments : [];
      const carousel = {
        message,
        child_attachments: cards.map((card) => clean({
          name: card.name,
          description: card.description,
          link: card.link_url,
          image_hash: card.image_hash,
          video_id: card.video_id
        }))
      };
      if (cta_type && cta_link_url) {
        carousel.call_to_action = { type: cta_type, value: { link: cta_link_url } };
      }
      spec.carousel_data = carousel;
    }

    return spec;
  };

  // ----- Validate inputs -----
  if (!account_id) return { error: 'Missing required parameter: account_id' };

  const actorCount = [!!page_id, !!instagram_actor_id].filter(Boolean).length;
  if (actorCount !== 1) {
    return { error: 'Provide exactly one actor: page_id OR instagram_actor_id (not both).' };
  }

  if (creative_type === 'link') {
    if (!link_url) return { error: "creative_type 'link' requires link_url" };
    if (!image_hash) return { error: "creative_type 'link' requires image_hash (upload an image first)" };
  }
  if (creative_type === 'video') {
    if (!video_id) return { error: "creative_type 'video' requires video_id" };
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
      if (!ca.image_hash && !ca.video_id) return { error: `Carousel card #${i + 1} needs image_hash or video_id` };
    }
  }

  console.log('📥 Input parameters received:', {
    account_id, actor: page_id ? 'page_id' : 'instagram_actor_id', creative_type
  });

  try {
    // 1) Token
    const userId = await getUserFromAccount(supabase, account_id);
    const token = await getFacebookToken(supabase, userId);
    if (!token) {
      return {
        error: 'No Facebook access token found for the user who owns this ad account',
        details: `Account ${account_id} belongs to user ${userId} but they have no Facebook token`
      };
    }

    // 2) object_story_spec
    const actor = page_id ? { page_id } : { instagram_actor_id };
    const object_story_spec = buildObjectStorySpec({
      actor, creative_type, message, cta_type, cta_link_url, link_url, image_hash, video_id, child_attachments
    });

    // 3) Create creative
    const url = `${baseUrl}/act_${account_id}/adcreatives`;
    const params = clean({
      name: creative_name,
      object_story_spec: JSON.stringify(object_story_spec),
      access_token: token
    });
    const body = new URLSearchParams(params);

    console.log('🧱 Creating Ad Creative at:', url);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    const json = await resp.json();
    if (!resp.ok || json?.error) {
      console.error('❌ Creative creation error:', json);
      return {
        error: `Ad creative creation failed: ${json?.error?.message || 'Unknown error'}`,
        details: json
      };
    }

    return {
      success: true,
      creative: { id: json.id, object_story_spec }
    };
  } catch (error) {
    console.error('💥 Error in executeFunction (create-ad-creative):', error);
    return {
      error: 'An error occurred while creating the ad creative.',
      details: error.message
    };
  }
};

/**
 * JSON Schema (single source of truth) for inputs
 * Reused for both MCP-native inputSchema and function.parameters
 */
const INPUT_SCHEMA = {
  type: 'object',
  properties: {
    account_id: { type: 'string', description: 'REQUIRED: Facebook ad account ID (no act_ prefix)' },
    page_id: { type: 'string', description: 'Facebook Page ID (mutually exclusive with instagram_actor_id)' },
    instagram_actor_id: { type: 'string', description: 'Instagram actor ID (mutually exclusive with page_id)' },
    creative_type: { type: 'string', enum: ['link', 'video', 'carousel'], description: 'Creative format (default: link)' },
    creative_name: { type: 'string', description: 'Optional creative name' },
    message: { type: 'string', description: 'Primary text / caption' },
    cta_type: { type: 'string', description: 'CTA type (e.g., SHOP_NOW, LEARN_MORE)' },
    cta_link_url: { type: 'string', description: 'CTA destination URL' },
    link_url: { type: 'string', description: 'Link destination (required for link; optional for video/cross-link)' },
    image_hash: { type: 'string', description: 'Image hash for link/carousel cards' },
    video_id: { type: 'string', description: 'Uploaded video ID for video creatives' },
    child_attachments: {
      type: 'array',
      description: 'Carousel cards (2–10). Each needs link_url and image_hash or video_id.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          link_url: { type: 'string' },
          image_hash: { type: 'string' },
          video_id: { type: 'string' }
        },
        required: ['link_url']
      }
    }
  },
  required: ['account_id', 'creative_type']
};

/**
 * Tool configuration with MCP-native fields + back-compat
 */
const apiTool = {
  function: executeFunction,
  definition: {
    // ✅ MCP-native (what most clients expect)
    name: 'create-ad-creative',
    description: 'Create a Facebook Ad Creative (LINK, VIDEO, CAROUSEL) using object_story_spec.',
    inputSchema: INPUT_SCHEMA,

    // ♻️ Back-compat for function-style loaders
    type: 'function',
    function: {
      name: 'create-ad-creative',
      description: 'Create a Facebook Ad Creative (LINK, VIDEO, CAROUSEL) using object_story_spec.',
      parameters: INPUT_SCHEMA
    }
  }
};

export { apiTool };
