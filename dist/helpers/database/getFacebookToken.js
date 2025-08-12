/**
 * Helper function to retrieve Facebook long-lived access token from Supabase
 * 
 * @param {Object} supabase - Supabase client instance
 * @param {string|number} userId - The user ID to get the token for
 * @returns {Promise<string|null>} - The Facebook access token or null if not found
 * @throws {Error} - If database query fails
 */
const getFacebookToken = async (supabase, userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!supabase) {
    throw new Error('Supabase client is required');
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('facebook_long_lived_token')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw new Error('Failed to retrieve Facebook token');
    }

    if (!data?.facebook_long_lived_token) {
      console.warn(`No Facebook token found for user ID: ${userId}`);
      return null;
    }

    return data.facebook_long_lived_token;
  } catch (error) {
    console.error('Error retrieving Facebook token:', error);
    throw error;
  }
};

export { getFacebookToken };