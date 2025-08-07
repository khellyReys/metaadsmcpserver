import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TokenExchangeRequest {
  shortLivedToken: string;
  userId?: string;
}

interface FacebookTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

interface FacebookTokenDebugResponse {
  data?: {
    is_valid: boolean;
    user_id: string;
    app_id: string;
    expires_at: number;
    scopes: string[];
  };
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

interface FacebookPermissionsResponse {
  data?: Array<{
    permission: string;
    status: string;
  }>;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

interface RateLimitState {
  count: number;
  resetTime: number;
}

// Simple in-memory rate limiting (resets every function cold start)
const rateLimits = new Map<string, RateLimitState>();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers.get('cf-connecting-ip') || 
                    req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown';

    // Rate limiting: 20 requests per 10 minutes per IP
    const now = Date.now();
    const resetWindow = 10 * 60 * 1000; // 10 minutes
    const maxRequests = 20;
    
    const currentLimit = rateLimits.get(clientIP);
    
    if (currentLimit) {
      if (now > currentLimit.resetTime) {
        // Reset the limit
        rateLimits.set(clientIP, { count: 1, resetTime: now + resetWindow });
      } else if (currentLimit.count >= maxRequests) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Rate limit exceeded. Please try again later.' 
          }),
          { 
            status: 429, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      } else {
        currentLimit.count += 1;
      }
    } else {
      rateLimits.set(clientIP, { count: 1, resetTime: now + resetWindow });
    }

    // Get Facebook app credentials from environment
    const FB_APP_ID = Deno.env.get('FACEBOOK_APP_ID')
    const FB_APP_SECRET = Deno.env.get('FACEBOOK_APP_SECRET')

    if (!FB_APP_ID || !FB_APP_SECRET) {
      console.error('Facebook app credentials not configured')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Server configuration error: Facebook credentials missing' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    const { shortLivedToken, userId }: TokenExchangeRequest = await req.json()

    if (!shortLivedToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Short-lived token is required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Step 1: Validate the short-lived token
    console.log('Validating short-lived token...')
    const validateUrl = `https://graph.facebook.com/v22.0/debug_token?` +
      `input_token=${shortLivedToken}&` +
      `access_token=${FB_APP_ID}|${FB_APP_SECRET}`

    const validateResponse = await fetch(validateUrl)
    const validateData: FacebookTokenDebugResponse = await validateResponse.json()

    if (validateData.error) {
      console.error('Token validation error:', validateData.error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Token validation failed: ${validateData.error.message}` 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!validateData.data?.is_valid) {
      console.error('Invalid token provided')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired Facebook token' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the token belongs to our app
    if (validateData.data.app_id !== FB_APP_ID) {
      console.error('Token belongs to different app:', validateData.data.app_id)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Token does not belong to this application' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Step 2: Exchange short-lived token for long-lived token
    console.log('Exchanging for long-lived token...')
    const exchangeUrl = `https://graph.facebook.com/v22.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&` +
      `client_id=${FB_APP_ID}&` +
      `client_secret=${FB_APP_SECRET}&` +
      `fb_exchange_token=${shortLivedToken}`

    const exchangeResponse = await fetch(exchangeUrl)
    const exchangeData: FacebookTokenResponse = await exchangeResponse.json()

    if (exchangeData.error) {
      console.error('Facebook token exchange error:', exchangeData.error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Facebook API error: ${exchangeData.error.message}` 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!exchangeData.access_token) {
      console.error('No access token in response:', exchangeData)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to get long-lived token from Facebook' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Step 3: Get user permissions for the long-lived token
    console.log('Fetching user permissions...')
    const permissionsUrl = `https://graph.facebook.com/v22.0/me/permissions?access_token=${exchangeData.access_token}`
    
    let grantedScopes: string[] = []
    try {
      const permissionsResponse = await fetch(permissionsUrl)
      const permissionsData: FacebookPermissionsResponse = await permissionsResponse.json()
      
      if (permissionsData.data && !permissionsData.error) {
        grantedScopes = permissionsData.data
          .filter((perm) => perm.status === 'granted')
          .map((perm) => perm.permission)
      } else if (permissionsData.error) {
        console.warn('Failed to fetch permissions:', permissionsData.error.message)
        // Don't fail the whole request, just log the warning
      }
    } catch (permError) {
      console.warn('Error fetching permissions:', permError)
      // Don't fail the whole request
    }

    // Step 4: Calculate expiration date
    const expiresIn = exchangeData.expires_in || 5184000 // Default ~60 days if not provided
    const expiresAt = new Date(Date.now() + (expiresIn * 1000))

    // Step 5: Debug token info for the long-lived token
    console.log('Getting long-lived token info...')
    let tokenInfo = null
    try {
      const debugUrl = `https://graph.facebook.com/v22.0/debug_token?` +
        `input_token=${exchangeData.access_token}&` +
        `access_token=${FB_APP_ID}|${FB_APP_SECRET}`

      const debugResponse = await fetch(debugUrl)
      const debugData: FacebookTokenDebugResponse = await debugResponse.json()
      
      if (debugData.data && !debugData.error) {
        tokenInfo = {
          userId: debugData.data.user_id,
          appId: debugData.data.app_id,
          expiresAt: debugData.data.expires_at ? new Date(debugData.data.expires_at * 1000) : expiresAt,
          isValid: debugData.data.is_valid,
          scopes: debugData.data.scopes || []
        }
      }
    } catch (debugError) {
      console.warn('Error getting token debug info:', debugError)
    }

    // Log success for monitoring
    console.log(`Successfully exchanged token for user ${validateData.data.user_id}, expires at ${expiresAt}`)

    // Step 6: Return successful response with comprehensive data
    return new Response(
      JSON.stringify({
        success: true,
        longLivedToken: exchangeData.access_token,
        shortLivedToken: shortLivedToken, // Include for reference
        expiresIn: expiresIn,
        expiresAt: expiresAt.toISOString(),
        tokenType: exchangeData.token_type || 'bearer',
        grantedScopes: grantedScopes,
        tokenInfo: tokenInfo,
        exchangedAt: new Date().toISOString(),
        facebookUserId: validateData.data.user_id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Token exchange error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Token exchange failed: ${error.message}`,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

/* 
Usage Example:

POST /functions/v1/exchange-facebook-token
{
  "shortLivedToken": "EAABC123...",
  "userId": "optional-user-id"
}

Response:
{
  "success": true,
  "longLivedToken": "EAABC456...",
  "shortLivedToken": "EAABC123...",
  "expiresIn": 5184000,
  "expiresAt": "2024-03-15T10:30:00.000Z",
  "tokenType": "bearer",
  "grantedScopes": ["email", "pages_read_engagement", "ads_management"],
  "tokenInfo": {
    "userId": "123456789",
    "appId": "your-app-id",
    "expiresAt": "2024-03-15T10:30:00.000Z",
    "isValid": true,
    "scopes": ["email", "pages_read_engagement"]
  },
  "exchangedAt": "2024-01-15T10:30:00.000Z",
  "facebookUserId": "123456789"
}

Environment Variables Required:
- FACEBOOK_APP_ID: Your Facebook App ID
- FACEBOOK_APP_SECRET: Your Facebook App Secret
*/