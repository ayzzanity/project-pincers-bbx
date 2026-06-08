require('dotenv').config();

const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CHALLONGE_API_KEY'
];

function readEnv() {
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    port: Number(process.env.PORT || 4000),
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    supabaseUrl: process.env.SUPABASE_URL,
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    challongeApiBaseUrl: process.env.CHALLONGE_API_BASE_URL || 'https://api.challonge.com/v1',
    challongeApiV21BaseUrl: process.env.CHALLONGE_API_V21_BASE_URL || 'https://api.challonge.com/v2.1',
    challongeCommunityId: process.env.CHALLONGE_COMMUNITY_ID || null,
    challongeApiKey: process.env.CHALLONGE_API_KEY
  };
}

module.exports = readEnv();
