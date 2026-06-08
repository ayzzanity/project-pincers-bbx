const { supabaseAdmin } = require('../lib/supabase');
const { AppError } = require('../utils/errors');

async function requireAuth(req, _res, next) {
  try {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      throw new AppError(401, 'auth_required', 'A bearer token is required.');
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      throw new AppError(401, 'invalid_token', 'The supplied auth token is invalid.');
    }

    await ensureProfile(data.user);

    req.accessToken = token;
    req.user = data.user;
    next();
  } catch (error) {
    next(error);
  }
}

async function ensureProfile(user) {
  const displayName = String(
    user.user_metadata?.display_name
    || user.email?.split('@')[0]
    || 'Player'
  ).trim();

  const { error } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: user.id,
      display_name: displayName
    }, {
      onConflict: 'id',
      ignoreDuplicates: true
    });

  if (error) {
    throw new AppError(500, 'profile_sync_failed', 'Could not synchronize the authenticated user profile.', {
      reason: error.message
    });
  }
}

module.exports = {
  requireAuth
};
