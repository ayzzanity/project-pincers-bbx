const { createClient } = require('@supabase/supabase-js');
const env = require('../config/env');

const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

function supabaseForToken(accessToken) {
  return createClient(env.supabaseUrl, env.supabasePublishableKey || env.supabaseServiceRoleKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

module.exports = {
  supabaseAdmin,
  supabaseForToken
};
