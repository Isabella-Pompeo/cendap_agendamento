'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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
        const { data: { session } } = await supabase.auth.getSession();
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
