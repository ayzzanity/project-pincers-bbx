require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function main() {
  const email = process.env.DEV_ADMIN_EMAIL;
  const password = process.env.DEV_ADMIN_PASSWORD;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!process.env.SUPABASE_URL || !publishableKey) {
    throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required.');
  }

  if (!email || !password) {
    throw new Error('DEV_ADMIN_EMAIL and DEV_ADMIN_PASSWORD are required.');
  }

  const supabase = createClient(process.env.SUPABASE_URL, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  console.log(data.session.access_token);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
