import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'venue_owner' | 'dj' | 'bartender' | 'guest';

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  points_balance: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, role: AppRole, displayName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileData) {
      setProfile(profileData);
    }

    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    const roles = (rolesData || []).map((r) => r.role as AppRole);
    const priority: AppRole[] = ['admin', 'venue_owner', 'dj', 'bartender', 'guest'];
    const picked = priority.find((p) => roles.includes(p)) || roles[0] || null;
    setRole(picked);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
        }
        
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, role: AppRole, displayName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { display_name: displayName }
      }
    });

    if (error) {
      return { error: error as Error };
    }

    // Email confirmation enabled: user exists but no session until they click the mail link
    if (data.user && !data.session) {
      return {
        error: Object.assign(
          new Error(
            'Check your email to confirm your account, then sign in. (Sandbox tip: disable “Confirm email” in Supabase Auth → Providers → Email.)'
          ),
          { name: 'EmailConfirmationRequired' }
        ),
      };
    }

    if (data.user) {
      // Ensure profile exists (trigger may already create it)
      await supabase.from('profiles').upsert(
        {
          user_id: data.user.id,
          email,
          display_name: displayName || email.split('@')[0],
        },
        { onConflict: 'user_id' }
      );

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: data.user.id, role });

      if (roleError && !/duplicate|unique/i.test(roleError.message)) {
        // Common when migrations aren't applied yet
        if (/schema cache|does not exist|PGRST|Could not find the table/i.test(roleError.message)) {
          return {
            error: new Error(
              'Database tables are missing. Run supabase/bootstrap_aravfges.sql in the Supabase SQL Editor, then try again.'
            ),
          };
        }
        return { error: roleError as Error };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
