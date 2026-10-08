/**
 * Centralized Authentication Service for ORCA Marine Intelligence.
 * Uses HTTP-only cookie browser authentication (credentials: 'include').
 * Strictly eliminates persistent JWT storage in localStorage (Part 5).
 */

export interface SafeUser {
  id: string;
  role: 'fisherman' | 'researcher' | 'authority' | 'admin';
  first_name: string;
  last_name?: string | null;
  full_name: string;
  phone_number?: string | null;
  email?: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  last_login_at?: string | null;
  profile?: Record<string, any>;
}

export interface AuthResponse {
  // Cookie-only authentication: the backend sets an HTTP-only `orca_token`
  // cookie and returns only safe user information — no JWT in JSON.
  user: SafeUser;
  welcome_message: string;
}

export interface OtpResponse {
  success: boolean;
  message: string;
  cooldown_seconds: number;
  dev_otp?: string | null;
  mode: 'development' | 'live' | 'simulated';
  step?: string;
}

export interface GenericResponse {
  success: boolean;
  message: string;
  status?: string;
}

/** Editable fields of a fisherman registration profile (all optional = "leave unchanged"). */
export interface FishermanProfileUpdate {
  age?: number;
  location?: string;
  vessel_name?: string;
  vessel_registration_number?: string;
  fishing_type?: string;
  preferred_language?: string;
  emergency_contact?: string;
  government_id_type?: string;
  government_id_number?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  safety_tracking_consent?: boolean;
}

/** Administrator-driven "Register Fisherman" payload (server-side admin session authorises it). */
export interface AdminFishermanCreate extends FishermanProfileUpdate {
  phone_number: string;
  name: string;
  age: number;
  location: string;
}

/** Administrator edit of a fisherman registration, including account activation. */
export interface AdminFishermanUpdate extends FishermanProfileUpdate {
  is_active?: boolean;
}

export interface FishermanDirectoryResponse {
  fishermen: SafeUser[];
  total: number;
}

export interface AuthorityRequestItem {
  user_id: string;
  full_name: string;
  official_email: string;
  employee_id: string;
  department: string;
  designation: string;
  state_region: string;
  area_of_responsibility: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  created_at: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_BASE_URL || 'http://localhost:8000';
const USER_STORAGE_KEY = 'orca_auth_user';

// Legacy cleanup: earlier builds persisted the JWT under this key. The JWT is
// now carried exclusively by the HTTP-only cookie (unreadable by JavaScript),
// so purge any stale copy from localStorage on application start.
try {
  localStorage.removeItem('orca_auth_token');
  localStorage.removeItem('orca_user_role');
} catch {
  // storage unavailable (private mode / SSR) — nothing to purge
}

export const clearAuthStorage = (): void => {
  try {
    // Also remove keys written by older builds (legacy user/role/token cache).
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem('orca_user_role');
    localStorage.removeItem('orca_auth_token');
  } catch (e) {
    console.warn('Failed to clear auth storage:', e);
  }
};

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  const res = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers,
    // Cookie-only auth: the HTTP-only `orca_token` cookie is the sole
    // browser credential. No Authorization header is ever generated here.
    credentials: 'include'
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail = data?.detail || res.statusText || 'Request failed';
    // Attach the HTTP status (additively) so callers can distinguish auth
    // failures (401/403) from validation or server errors without parsing text.
    const error = new Error(detail) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }

  return data as T;
}

export const authService = {
  // --------------------------------------------------------------------------
  // Fisherman Authentication
  // --------------------------------------------------------------------------
  sendFishermanOtp: async (phone_number: string, purpose: 'login' | 'signup'): Promise<OtpResponse> => {
    return apiFetch<OtpResponse>('/auth/fisherman/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone_number, purpose })
    });
  },

  verifyFishermanOtp: async (phone_number: string, otp: string, purpose: 'login' | 'signup'): Promise<AuthResponse | GenericResponse> => {
    return apiFetch<AuthResponse | GenericResponse>('/auth/fisherman/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone_number, otp, purpose })
    });
  },

  signupFisherman: async (payload: {
    phone_number: string;
    name: string;
    age: number;
    location: string;
    vessel_name?: string;
    vessel_registration_number?: string;
    fishing_type?: string;
    preferred_language?: string;
    emergency_contact?: string;
  }): Promise<GenericResponse> => {
    return apiFetch<GenericResponse>('/auth/fisherman/signup', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // --------------------------------------------------------------------------
  // Researcher Authentication
  // --------------------------------------------------------------------------
  sendResearcherSignupOtp: async (email: string): Promise<OtpResponse> => {
    return apiFetch<OtpResponse>('/auth/researcher/send-signup-otp', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  verifyResearcherSignupOtp: async (email: string, otp: string): Promise<GenericResponse> => {
    return apiFetch<GenericResponse>('/auth/researcher/verify-signup-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp })
    });
  },

  signupResearcher: async (payload: {
    email: string;
    first_name: string;
    last_name: string;
    mobile_number: string;
    area_of_research: string;
    institution?: string;
    research_specialization?: string;
    password: string;
    confirm_password: string;
  }): Promise<GenericResponse> => {
    return apiFetch<GenericResponse>('/auth/researcher/signup', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  loginResearcher: async (identifier: string, password: string, otp?: string): Promise<OtpResponse | AuthResponse> => {
    return apiFetch<OtpResponse | AuthResponse>('/auth/researcher/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, otp })
    });
  },

  // --------------------------------------------------------------------------
  // Government Authority Authentication
  // --------------------------------------------------------------------------
  sendAuthoritySignupOtp: async (type: 'email' | 'mobile', target: string): Promise<OtpResponse> => {
    return apiFetch<OtpResponse>('/auth/authority/request-access/send-otp', {
      method: 'POST',
      body: JSON.stringify({ type, target })
    });
  },

  verifyAuthoritySignupOtp: async (type: 'email' | 'mobile', target: string, otp: string): Promise<GenericResponse> => {
    return apiFetch<GenericResponse>('/auth/authority/request-access/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ type, target, otp })
    });
  },

  requestAuthorityAccess: async (payload: {
    full_name: string;
    designation: string;
    department: string;
    official_email: string;
    mobile_number: string;
    employee_id: string;
    state_region: string;
    area_of_responsibility: string;
    password: string;
    confirm_password: string;
  }): Promise<GenericResponse> => {
    return apiFetch<GenericResponse>('/auth/authority/request-access', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  loginAuthority: async (identifier: string, password: string, otp?: string): Promise<OtpResponse | AuthResponse> => {
    return apiFetch<OtpResponse | AuthResponse>('/auth/authority/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, otp })
    });
  },

  // --------------------------------------------------------------------------
  // Administrator Operations (Parts 1, 2, 16, 17)
  // --------------------------------------------------------------------------
  loginAdmin: async (email: string, password: string): Promise<AuthResponse> => {
    return apiFetch<AuthResponse>('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  listAuthorityRequests: async (status_filter?: string): Promise<{ requests: AuthorityRequestItem[]; total: number }> => {
    const q = status_filter ? `?status_filter=${status_filter}` : '';
    return apiFetch<{ requests: AuthorityRequestItem[]; total: number }>(`/auth/admin/authority-requests${q}`, {
      method: 'GET'
    });
  },

  approveAuthorityRequest: async (
    authority_user_id: string,
    action: 'approve' | 'reject' | 'suspend',
    reason?: string
  ): Promise<GenericResponse> => {
    return apiFetch<GenericResponse>('/auth/admin/approve-authority', {
      method: 'POST',
      body: JSON.stringify({ authority_user_id, action, reason })
    });
  },

  // --------------------------------------------------------------------------
  // Fisherman Registration Management (server-side `require_admin` enforced)
  // --------------------------------------------------------------------------
  listFishermen: async (search?: string): Promise<FishermanDirectoryResponse> => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiFetch<FishermanDirectoryResponse>(`/auth/admin/fishermen${q}`, {
      method: 'GET'
    });
  },

  createFisherman: async (payload: AdminFishermanCreate): Promise<SafeUser> => {
    return apiFetch<SafeUser>('/auth/admin/fishermen', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  updateFisherman: async (userId: string, payload: AdminFishermanUpdate): Promise<SafeUser> => {
    return apiFetch<SafeUser>(`/auth/admin/fishermen/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  // --------------------------------------------------------------------------
  // Fisherman self-service registration edit (scoped to the session identity)
  // --------------------------------------------------------------------------
  updateMyFishermanProfile: async (payload: FishermanProfileUpdate): Promise<SafeUser> => {
    return apiFetch<SafeUser>('/auth/fishermen/me/profile', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  // --------------------------------------------------------------------------
  // General Session Profile & Logout (Part 20)
  // --------------------------------------------------------------------------
  getCurrentUser: async (): Promise<SafeUser> => {
    return apiFetch<SafeUser>('/auth/me', { method: 'GET' });
  },

  logout: async (): Promise<GenericResponse> => {
    try {
      const res = await apiFetch<GenericResponse>('/auth/logout', { method: 'POST' });
      clearAuthStorage();
      return res;
    } catch {
      clearAuthStorage();
      return { success: true, message: 'Logged out successfully' };
    }
  }
};
