import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError } from '../lib/api.js';
import type { SessionUser } from '../lib/types.js';

interface AuthState {
  // undefined while the first check runs, null when signed out.
  user: SessionUser | null | undefined;
  signIn: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    api<SessionUser>('/auth/me')
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch((error: unknown) => {
        // 401 simply means "not signed in". Anything else (API down) is also
        // shown as signed out; the sign-in form then reports the real error.
        if (!cancelled) setUser(null);
        if (!(error instanceof ApiError && error.status === 401)) {
          console.warn('Could not check the session');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (phone: string, password: string) => {
    const me = await api<SessionUser>('/auth/login', {
      method: 'POST',
      body: { phone, password },
    });
    setUser(me);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api<void>('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, signIn, signOut }),
    [user, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
