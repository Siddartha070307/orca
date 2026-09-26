import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type UserRole = 'fisherman' | 'authority' | 'researcher';

interface RoleContextValue {
  role: UserRole | null;
  setRole: (role: UserRole) => void;
  switchRole: () => void;
  isRoleSelected: boolean;
}

const STORAGE_KEY = 'orca_user_role';

export const RoleContext = createContext<RoleContextValue>({
  role: null,
  setRole: () => {},
  switchRole: () => {},
  isRoleSelected: false
});

export const RoleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'fisherman' || stored === 'authority' || stored === 'researcher') {
        return stored;
      }
    } catch (e) {
      console.warn('Failed to access localStorage for user role:', e);
    }
    return null;
  });

  const setRole = useCallback((newRole: UserRole) => {
    setRoleState(newRole);
    try {
      localStorage.setItem(STORAGE_KEY, newRole);
    } catch (e) {
      console.warn('Failed to persist user role:', e);
    }
  }, []);

  const switchRole = useCallback(() => {
    setRoleState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear user role:', e);
    }
  }, []);

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole,
        switchRole,
        isRoleSelected: role !== null
      }}
    >
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => useContext(RoleContext);
