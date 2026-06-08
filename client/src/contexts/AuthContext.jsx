import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user || null);
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user || null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!user) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, role')
        .eq('id', user.id)
        .maybeSingle();

      if (!cancelled) {
        setProfile(error ? null : data);
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function signUp({ email, password, displayName }) {
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName
        }
      }
    });

    const nextUser = result.data.user;
    if (nextUser) {
      await supabase.from('profiles').upsert({
        id: nextUser.id,
        display_name: displayName,
        role: 'player'
      });
    }

    return result;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      isAdmin: profile?.role === 'admin',
      signIn,
      signUp,
      signOut
    }),
    [session, user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
