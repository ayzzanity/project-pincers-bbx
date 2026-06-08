require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function main() {
  const email = process.env.DEV_ADMIN_EMAIL;
  const password = process.env.DEV_ADMIN_PASSWORD;
  const displayName = process.env.DEV_ADMIN_DISPLAY_NAME || 'BBX Admin';

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  if (!email || !password) {
    throw new Error('DEV_ADMIN_EMAIL and DEV_ADMIN_PASSWORD are required.');
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName
    }
  });

  const userAlreadyExists = createError?.message?.toLowerCase().includes('already');
  if (createError && !userAlreadyExists) {
    throw createError;
  }

  const user = created?.user || await findUserByEmail(supabase, email);
  if (!user) {
    throw new Error(`Could not find or create user for ${email}.`);
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      display_name: displayName,
      role: 'admin'
    }, { onConflict: 'id' });

  if (profileError) {
    throw profileError;
  }

  console.log(`Admin user ready: ${email}`);
  console.log(`User ID: ${user.id}`);
}

async function findUserByEmail(supabase, email) {
  let page = 1;

  while (page < 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;

    const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 100) return null;

    page += 1;
  }

  return null;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
