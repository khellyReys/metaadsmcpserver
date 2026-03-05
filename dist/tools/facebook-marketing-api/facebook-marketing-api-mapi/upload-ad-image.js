/**
 * MCP Tool: Upload Ad Image
 * Uploads an image to Facebook /adimages endpoint and returns the image hash
 * Supports both URL upload and file upload methods
 */
import { getBaseUrl, resolveToken, clean } from './_shared-helpers.js';

const executeFunction = async ({
  // Required
  account_id,              // REQUIRED: ad account id (no "act_" prefix)
  
  // Image source (one required)
  image_url = null,        // Option 1: Upload from URL
  image_file = null,       // Option 2: Upload file (base64 encoded)
  image_name = null,       // Optional: filename for file uploads
  
  // Optional metadata
  creative_folder_id = null // Optional: organize images in folders
}) => {
  const baseUrl = getBaseUrl();

  // Upload image by URL
  const uploadImageByUrl = async ({ token, account_id, url, creative_folder_id = null }) => {
    const endpoint = `${baseUrl}/act_${account_id}/adimages`;
    const form = new FormData();
    
    form.set('url', url);
    form.set('access_token', token);
    
    if (creative_folder_id) {
      form.set('creative_folder_id', creative_folder_id);
    }

    const resp = await fetch(endpoint, { method: 'POST', body: form });
    const json = await resp.json();
    
    if (!resp.ok || json?.error) {
      const msg = json?.error?.message || 'Unknown error';
      const code = json?.error?.code;
      const errorType = json?.error?.error_subcode;
      
      // Enhanced error messages
      if (code === 3) {
        throw new Error(`Facebook app lacks required permissions. Error: ${msg}. Please ensure your app has 'ads_management' permission and Marketing API access.`);
      }
      if (code === 1705) {
        throw new Error(`Image URL not accessible: ${msg}. Please ensure the image URL is publicly accessible and returns a valid image file.`);
      }
      if (errorType === 1885703) {
        throw new Error(`Image format not supported: ${msg}. Please use JPG, PNG, GIF, or WebP format.`);
      }
      if (code === 100) {
        throw new Error(`Invalid parameters: ${msg}`);
      }
      
      throw new Error(`Image upload failed: ${msg} (Code: ${code})`);
    }
    
    // Parse response - Facebook returns images object with hash as key
    const images = json.images || {};
    const imageHashes = Object.keys(images);
    
    if (imageHashes.length === 0) {
      throw new Error('Image upload succeeded but no image hash was returned');
    }
    
    // Get the first (and usually only) image hash
    const imageHash = imageHashes[0];
    const imageData = images[imageHash];
    
    return {
      hash: imageHash,
      url: imageData?.url,
      width: imageData?.width,
      height: imageData?.height,
      permalink_url: imageData?.permalink_url
    };
  };

  // Upload image by file (base64)
  const uploadImageByFile = async ({ token, account_id, fileData, fileName, creative_folder_id = null }) => {
    const endpoint = `${baseUrl}/act_${account_id}/adimages`;
    const form = new FormData();
    
    // Convert base64 to blob if needed
    let fileBlob;
    if (typeof fileData === 'string' && fileData.startsWith('data:')) {
      // Handle data URL format: data:image/jpeg;base64,/9j/4AAQ...
      const response = await fetch(fileData);
      fileBlob = await response.blob();
    } else if (typeof fileData === 'string') {
      // Handle raw base64
      const byteString = atob(fileData);
      const arrayBuffer = new ArrayBuffer(byteString.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i);
      }
      fileBlob = new Blob([arrayBuffer]);
    } else {
      fileBlob = fileData; // Assume it's already a Blob/File
    }
    
    form.set('source', fileBlob, fileName || 'image.jpg');
    form.set('access_token', token);
    
    if (creative_folder_id) {
      form.set('creative_folder_id', creative_folder_id);
    }

    const resp = await fetch(endpoint, { method: 'POST', body: form });
    const json = await resp.json();
    
    if (!resp.ok || json?.error) {
      const msg = json?.error?.message || 'Unknown error';
      const code = json?.error?.code;
      
      if (code === 3) {
        throw new Error(`Facebook app lacks required permissions. Error: ${msg}`);
      }
      
      throw new Error(`Image file upload failed: ${msg} (Code: ${code})`);
    }
    
    const images = json.images || {};
    const imageHashes = Object.keys(images);
    
    if (imageHashes.length === 0) {
      throw new Error('Image upload succeeded but no image hash was returned');
    }
    
    const imageHash = imageHashes[0];
    const imageData = images[imageHash];
    
    return {
      hash: imageHash,
      url: imageData?.url,
      width: imageData?.width,
      height: imageData?.height,
      permalink_url: imageData?.permalink_url
    };
  };

  // ---------- validation ----------
  if (!account_id) return { error: 'Missing required parameter: account_id' };
  
  // Must provide either image_url or image_file
  if (!image_url && !image_file) {
    return { error: 'Must provide either image_url or image_file' };
  }
  
  if (image_url && image_file) {
    return { error: 'Provide either image_url OR image_file, not both' };
  }

  try {
    const { token } = await resolveToken(account_id);

    // 2) Upload image
    let uploadResult;
    
    if (image_url) {
      uploadResult = await uploadImageByUrl({ 
        token, 
        account_id, 
        url: image_url, 
        creative_folder_id 
      });
    } else {
      uploadResult = await uploadImageByFile({ 
        token, 
        account_id, 
        fileData: image_file, 
        fileName: image_name,
        creative_folder_id 
      });
    }

    return {
      success: true,
      image: {
        hash: uploadResult.hash,
        url: uploadResult.url,
        width: uploadResult.width,
        height: uploadResult.height,
        permalink_url: uploadResult.permalink_url
      },
      account_id: account_id,
      upload_method: image_url ? 'url' : 'file'
    };

  } catch (error) {
    console.error('💥 Error in executeFunction (upload-ad-image):', error);
    
    // Provide helpful suggestions based on error type
    let suggestion = '';
    if (error.message.includes('lacks required permissions')) {
      suggestion = 'Your Facebook app needs ads_management permission. Go to App Dashboard > App Review > Permissions and Features to request it.';
    } else if (error.message.includes('not accessible')) {
      suggestion = 'Ensure the image URL is publicly accessible and returns a valid image file (JPG, PNG, GIF, or WebP).';
    } else if (error.message.includes('format not supported')) {
      suggestion = 'Use supported image formats: JPG, PNG, GIF, or WebP. Max file size is usually 30MB.';
    }
    
    return { 
      error: error.message,
      suggestion: suggestion || 'Check that your image URL is valid and your Facebook app has proper permissions.',
      details: error.stack 
    };
  }
};

/** JSON Schema */
const INPUT_SCHEMA = {
  type: 'object',
  properties: {
    account_id: { 
      type: 'string', 
      description: 'REQUIRED: Facebook ad account ID (no act_ prefix)' 
    },
    
    image_url: { 
      type: 'string', 
      description: 'Upload from URL: publicly accessible image URL (JPG, PNG, GIF, WebP)' 
    },
    
    image_file: { 
      type: 'string', 
      description: 'Upload file: base64 encoded image data or data URL (data:image/jpeg;base64,...)' 
    },
    
    image_name: { 
      type: 'string', 
      description: 'Optional filename for file uploads (e.g., "campaign-hero.jpg")' 
    },
    
    creative_folder_id: { 
      type: 'string', 
      description: 'Optional: Facebook Creative Folder ID to organize uploaded images' 
    }
  },
  required: ['account_id'],
  oneOf: [
    { required: ['image_url'] },
    { required: ['image_file'] }
  ]
};

/** MCP tool wrapper */
const apiTool = {
  function: executeFunction,
  definition: {
    name: 'upload_ad_image',
    description: 'Upload an image to Facebook Ad Account and get the image hash for use in ad creatives. Supports both URL and file upload methods.',
    inputSchema: INPUT_SCHEMA,
    type: 'function',
    function: {
      name: 'upload_ad_image',
      description: 'Upload an image to Facebook Ad Account and get the image hash for use in ad creatives. Supports both URL and file upload methods.',
      parameters: INPUT_SCHEMA
    }
  }
};

export { apiTool };