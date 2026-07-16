'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';

// Lightweight local stub for supabase to avoid runtime errors when Supabase
// integration is intentionally removed. This provides minimal, non-blocking
// implementations used by the app (no real network calls).
const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (_cb: (event: string, session: any) => void) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => ({}),
  },
  from: (_table: string) => ({
    select: (_sel: string) => ({
      eq: (_col: string, _val: any) => ({
        maybeSingle: async () => ({ data: null, error: null }),
      }),
    }),
  }),
  channel: (_name: string, _opts?: any) => {
    const ch: any = {
      on: (_type: string, _filter: any, _cb?: any) => ch,
      subscribe: async (cb?: any) => {
        if (typeof cb === 'function') await cb('SUBSCRIBED');
        return { status: 'SUBSCRIBED' };
      },
      presenceState: () => ({}),
      track: async (_payload: any) => ({}),
      unsubscribe: () => {},
    };
    return ch;
  },
};

// Expose stub on globalThis so other client modules referencing `supabase`
// without importing won't throw a ReferenceError.
if (typeof globalThis !== 'undefined') {
  try {
    (globalThis as any).supabase = supabase;
  } catch {
    // ignore
  }
}

export interface UserProfile {
  cpf: string;
  full_name: string;
  phone: string;
  avatar_url?: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  signOut: () => Promise<void>;
  refreshProfile: (userId?: string) => Promise<void>;
  isLoading: boolean;
  onlineUsers: Set<string>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  signOut: async () => {},
  refreshProfile: async () => {},
  isLoading: true,
  onlineUsers: new Set(),
});

const isInvalidRefreshTokenError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String((error as any)?.message || '');
  const normalizedMessage = message.toLowerCase();

  return normalizedMessage.includes('invalid refresh token') || normalizedMessage.includes('refresh token not found');
};

const clearStoredSupabaseSession = () => {
  if (typeof window === 'undefined') return;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : '';

    if (projectRef) {
      const storageKey = `sb-${projectRef}-auth-token`;
      window.localStorage.removeItem(storageKey);
      window.localStorage.removeItem(`${storageKey}-code-verifier`);
      window.localStorage.removeItem(`${storageKey}-user`);
      return;
    }
  } catch {
    // Fall back to scanning Supabase auth keys for this browser origin below.
  }

  Object.keys(window.localStorage)
    .filter(key => key.startsWith('sb-') && (key.includes('-auth-token') || key.endsWith('-code-verifier') || key.endsWith('-user')))
    .forEach(key => window.localStorage.removeItem(key));
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const currentUserIdRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('cpf, full_name, phone, avatar_url')
        .eq('id', userId)
        .maybeSingle();
      
      if (!error && data) {
        if (currentUserIdRef.current === userId) {
          setProfile(data);
        }
      } else {
        if (error) {
          console.error('Error fetching profile:', error);
        }
        if (currentUserIdRef.current === userId) {
          setProfile(null);
        }
      }
    } catch (e) {
      console.error('Error fetching profile:', e);
      if (currentUserIdRef.current === userId) {
        setProfile(null);
      }
    }
  }, []);

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          if (isInvalidRefreshTokenError(error)) {
            clearStoredSupabaseSession();
            currentUserIdRef.current = null;
            setSession(null);
            setUser(null);
            setProfile(null);
            return;
          }

          throw error;
        }

        const { session } = data;
        currentUserIdRef.current = session?.user?.id ?? null;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Error getting session:', error);
        currentUserIdRef.current = null;
        setSession(null);
        setUser(null);
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextUser = session?.user ?? null;
        const previousUserId = currentUserIdRef.current;

        currentUserIdRef.current = nextUser?.id ?? null;
        setSession(session);
        setUser(nextUser);

        if (!nextUser) {
          setProfile(null);
          setIsLoading(false);
          return;
        }

        if (previousUserId !== nextUser.id) {
          setProfile(null);
        }

        setIsLoading(false);

        setTimeout(() => {
          if (currentUserIdRef.current === nextUser.id) {
            void fetchProfile(nextUser.id);
          }
        }, 0);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Presence tracking
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('global-presence', {
      config: { presence: { key: user.id } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineIds = new Set(Object.keys(state));
        setOnlineUsers(onlineIds);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async (userId?: string) => {
    const idToFetch = userId || user?.id;
    if (idToFetch) {
      await fetchProfile(idToFetch);
    }
  }, [fetchProfile, user?.id]);

  return (
    <AuthContext.Provider value={{ session, user, profile, signOut, refreshProfile, isLoading, onlineUsers }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
