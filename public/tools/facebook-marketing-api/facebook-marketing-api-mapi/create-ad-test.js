/**
 * MCP Tool: Create Ad for an existing Ad Set (LINK/PHOTO/VIDEO)
 *
 * Flow (no external deps beyond fetch & optional Supabase):
 * 1) Validate inputs
 * 2) Upload media (adimages/advideos) to obtain image_hash or video_id
 * 3) Build object_story_spec (unpublished Page post)
 * 4) Create Ad Creative -> get creative_id
 * 5) Create Ad on /ads (attach creative to adset) with status_on_create (default "ACTIVE")
 * 6) Return { ad_id, creative_id, adset_id, status }
 *
 * Notes:
 * - creative_name is REQUIRED (per user instruction: "do not omit this").
 * - status_on_create default is "ACTIVE" (per user instruction).
 * - Temporarily: accepts direct access_token input (since Ads Management permission may not yet be approved).
 */

export const executeFunction = async ({
    // Auth
    access_token = null, // TEMPORARY direct input allowed
    userId = null,
  
    // Placement
    ad_account_id,
    adset_id,
  
    // Creative ownership
    page_id,
    instagram_actor_id = null,
  
    // Ad naming & status
    ad_name,
    creative_name,
    status_on_create = "ACTIVE",
  
    // Format selection
    format,
  
    // Copy & CTA
    primary_text = null,
    headline = null,
    description = null,
    cta_type = null,
    destination_url = null,
  
    // Media inputs
    image_hash = null,
    image_url = null,
    image_file = null,
  
    video_id = null,
    video_url = null,
    video_file = null,
  
    api_version = process.env.FACEBOOK_API_VERSION || "v23.0",
  }) => {
    // ... rest unchanged
  };
  
  const apiTool = {
    function: executeFunction,
    definition: {
      type: 'function',
      function: {
        name: 'create-ad-test',
        description: 'Create a Facebook Ad for an existing Ad Set using object_story_spec (LINK/PHOTO/VIDEO). Handles media upload, creative creation, and ad creation. Temporarily allows direct access_token input.',
        parameters: {
          type: 'object',
          properties: {
            access_token: { type: 'string', description: 'TEMPORARY: Direct Facebook access token (ads_management scope). Optional if userId is provided for Supabase lookup.' },
            userId: { type: 'string', description: 'User ID to look up long-lived token in Supabase when access_token not provided.' },
            
            ad_account_id: { type: 'string' },
            adset_id: { type: 'string' },
            page_id: { type: 'string' },
            instagram_actor_id: { type: 'string', nullable: true },
  
            ad_name: { type: 'string' },
            creative_name: { type: 'string' },
            status_on_create: { type: 'string', enum: ['ACTIVE','PAUSED','ARCHIVED'], description: 'Initial ad status. Default ACTIVE.' },
  
            format: { type: 'string', enum: ['LINK','PHOTO','VIDEO'] },
  
            primary_text: { type: 'string', nullable: true },
            headline: { type: 'string', nullable: true },
            description: { type: 'string', nullable: true },
            cta_type: { type: 'string', nullable: true },
            destination_url: { type: 'string', nullable: true },
  
            image_hash: { type: 'string', nullable: true },
            image_url: { type: 'string', nullable: true },
            image_file: { type: 'string', nullable: true },
  
            video_id: { type: 'string', nullable: true },
            video_url: { type: 'string', nullable: true },
            video_file: { type: 'string', nullable: true },
  
            api_version: { type: 'string', nullable: true }
          },
          required: ['ad_account_id','adset_id','page_id','ad_name','creative_name','format']
        }
      }
    }
  };

  export default apiTool;
  