import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  SafeUser,
  authService,
  clearAuthStorage
} from '../services/authService';

export type UserRole = 'fisherman' | 'authority' | 'researcher' | 'admin';

export interface RoleContextValue {
  role: UserRole | null;
  user: SafeUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  welcomeMessage: string | null;
  /** Unauthenticated persona/navigation choice only — never authenticates or escalates. */
  setRole: (role: UserRole) => void;
  switchRole: () => void;
  /** No token parameter: the HTTP-only cookie issued by the backend is the credential. */
  login: (user: SafeUser, welcomeMsg?: string) => void;
  logout: () => Promise<void>;
  dismissWelcome: () => void;
  isRoleSelected: boolean;
}

export const RoleContext = createContext<RoleContextValue>({
  role: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  welcomeMessage: null,
  setRole: () => {},
  switchRole: () => {},
  login: () => {},
  logout: async () => {},
  dismissWelcome: () => {},
  isRoleSelected: false
});

export const RoleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Server-authoritative identity: never hydrate user/role from localStorage.
  // The backend /auth/me response (HTTP-only cookie) is the sole source of truth.
  const [user, setUserState] = useState<SafeUser | null>(null);
  // Unauthenticated persona selection (role-selection screen navigation UX only).
  const [selectedPersona, setSelectedPersona] = useState<UserRole | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // While authenticated, the effective role ALWAYS equals the server-returned
  // user.role. Persona selection state can never grant or escalate a role, so
  // a client-side call like setRole('admin') has no effect on an authenticated
  // fisherman/researcher/authority session.
  const role: UserRole | null = user ? user.role : selectedPersona;

  // Authoritative server-side session verification via HTTP-only cookie on mount (Part 4, 5, 19)
  useEffect(() => {
    let isMounted = true;
    const verifySession = async () => {
      try {
        const verifiedUser = await authService.getCurrentUser();
        if (isMounted) {
          setUserState(verifiedUser);
        }
      } catch (err) {
        // Backend returned 401 or network error: clear unauthenticated local state
        if (isMounted) {
          clearAuthStorage();
          setUserState(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    verifySession();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback((newUser: SafeUser, welcomeMsg?: string) => {
    // The HTTP-only cookie set by the backend is the persistent credential;
    // only safe user information is kept in React memory for rendering.
    setUserState(newUser);
    setSelectedPersona(null);
    if (welcomeMsg) {
      setWelcomeMessage(welcomeMsg);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (e) {
      console.warn('Error during logout:', e);
    } finally {
      clearAuthStorage();
      setUserState(null);
      setSelectedPersona(null);
      setWelcomeMessage(null);
    }
  }, []);

  const setRole = useCallback((newRole: UserRole) => {
    // Records a persona/navigation choice for unauthenticated users only.
    // Ignored entirely while authenticated because `role` is derived from
    // the server-returned user.role. Never authenticates by itself.
    setSelectedPersona(newRole);
  }, []);

  const switchRole = useCallback(() => {
    logout();
  }, [logout]);

  const dismissWelcome = useCallback(() => {
    setWelcomeMessage(null);
  }, []);

  return (
    <RoleContext.Provider
      value={{
        role,
        user,
        isAuthenticated: !!user,
        isLoading,
        welcomeMessage,
        setRole,
        switchRole,
        login,
        logout,
        dismissWelcome,
        isRoleSelected: role !== null
      }}
    >
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => useContext(RoleContext);
export const useAuth = () => useContext(RoleContext);
