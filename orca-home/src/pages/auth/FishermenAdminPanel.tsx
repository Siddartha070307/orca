/**
 * FishermenAdminPanel — administrator registry of fisherman registrations.
 *
 * Adapted from the reference vessel.zip "Fishermen Directory" (search + table +
 * Register/Edit modal), but wired into ORCA's existing stack:
 *   - transport: authService (cookie-only `orca_token`, credentials: 'include')
 *   - authorisation: server-side `require_admin` on every endpoint
 *   - data: the existing fisherman_profiles table (additive columns only)
 *
 * Normal fishermen never see this panel and cannot call these endpoints.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Ship,
  MapPin,
  AlertCircle,
  CheckCircle2,
  X,
  UserCheck,
  UserX
} from 'lucide-react';
import {
  authService,
  AdminFishermanCreate,
  AdminFishermanUpdate,
  FishermanProfileUpdate,
  SafeUser
} from '../../services/authService';
import { SUPPORTED_LANGUAGES } from '../../utils/i18n';

const GOVERNMENT_ID_TYPES = [
  'Aadhaar',
  'Voter ID',
  'Driving Licence',
  'Fishing Licence',
  'Ration Card',
  'Other'
];

const EMPTY_FORM = {
  name: '',
  phone_number: '',
  age: '',
  location: '',
  vessel_name: '',
  vessel_registration_number: '',
  fishing_type: '',
  preferred_language: 'en',
  emergency_contact: '',
  emergency_contact_name: '',
  emergency_contact_relation: '',
  government_id_type: '',
  government_id_number: '',
  safety_tracking_consent: false,
  is_active: true
};

type FormState = typeof EMPTY_FORM;

interface FormErrors {
  [key: string]: string;
}

function maskPhone(phone?: string | null): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 4 ? `+${digits.slice(0, 2)}******${digits.slice(-4)}` : phone;
}

function buildProfilePayload(form: FormState): FishermanProfileUpdate {
  return {
    age: form.age ? Number(form.age) : undefined,
    location: form.location.trim() || undefined,
    vessel_name: form.vessel_name.trim() || '',
    vessel_registration_number: form.vessel_registration_number.trim() || '',
    fishing_type: form.fishing_type.trim() || '',
    preferred_language: form.preferred_language || undefined,
    emergency_contact: form.emergency_contact.trim() || '',
    government_id_type: form.government_id_type.trim() || '',
    government_id_number: form.government_id_number.trim() || '',
    emergency_contact_name: form.emergency_contact_name.trim() || '',
    emergency_contact_relation: form.emergency_contact_relation.trim() || '',
    safety_tracking_consent: Boolean(form.safety_tracking_consent)
  };
}

function validateForm(form: FormState, isCreate: boolean): FormErrors {
  const errors: FormErrors = {};

  if (isCreate) {
    if (form.name.trim().length < 2) errors.name = 'Full name is required.';
    const digits = form.phone_number.replace(/\D/g, '');
    if (digits.length < 10) errors.phone_number = 'A valid 10-digit mobile number is required.';
  }

  const age = Number(form.age);
  if (!form.age || Number.isNaN(age) || age < 16 || age > 100) {
    errors.age = 'Age must be between 16 and 100 years.';
  }

  if (form.location.trim().length < 2) errors.location = 'Base port / coastal village is required.';

  return errors;
}

export const FishermenAdminPanel: React.FC = () => {
  const [fishermen, setFishermen] = useState<SafeUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal state: null = closed, 'create' = register, or the user being edited
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  const fetchFishermen = useCallback(async (term?: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await authService.listFishermen(term);
      setFishermen(data.fishermen);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load fisherman registry');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFishermen();
  }, [fetchFishermen]);

  // Debounced search
  useEffect(() => {
    const handle = setTimeout(() => {
      fetchFishermen(search.trim() || undefined);
    }, 300);
    return () => clearTimeout(handle);
  }, [search, fetchFishermen]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalMode('create');
  };

  const openEdit = (user: SafeUser) => {
    const p = (user.profile || {}) as Record<string, any>;
    setEditingUser(user);
    setForm({
      name: user.full_name,
      phone_number: user.phone_number || '',
      age: p.age != null ? String(p.age) : '',
      location: p.location || '',
      vessel_name: p.vessel_name || '',
      vessel_registration_number: p.vessel_registration_number || '',
      fishing_type: p.fishing_type || '',
      preferred_language: p.preferred_language || 'en',
      emergency_contact: p.emergency_contact || '',
      emergency_contact_name: p.emergency_contact_name || '',
      emergency_contact_relation: p.emergency_contact_relation || '',
      government_id_type: p.government_id_type || '',
      government_id_number: p.government_id_number || '',
      safety_tracking_consent: Boolean(p.safety_tracking_consent),
      is_active: user.is_active
    });
    setFormErrors({});
    setModalMode('edit');
  };

  const closeModal = () => {
    if (saving) return;
    setModalMode(null);
    setEditingUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isCreate = modalMode === 'create';
    const errors = validateForm(form, isCreate);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    setErrorMessage(null);
    try {
      if (isCreate) {
        const payload: AdminFishermanCreate = {
          ...(buildProfilePayload(form) as any),
          phone_number: form.phone_number.trim(),
          name: form.name.trim(),
          age: Number(form.age),
          location: form.location.trim()
        };
        const created = await authService.createFisherman(payload);
        setMessage(`Registration created for ${created.full_name} (${created.phone_number}).`);
      } else if (editingUser) {
        const payload: AdminFishermanUpdate = {
          ...(buildProfilePayload(form) as any),
          is_active: Boolean(form.is_active)
        };
        const updated = await authService.updateFisherman(editingUser.id, payload);
        setMessage(`Registration updated for ${updated.full_name}.`);
      }
      setModalMode(null);
      setEditingUser(null);
      await fetchFishermen(search.trim() || undefined);
      setTimeout(() => setMessage(null), 6000);
    } catch (err: any) {
      setFormErrors({ submit: err.message || 'Saving the registration failed.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: SafeUser) => {
    setActionLoading(user.id);
    setErrorMessage(null);
    try {
      const updated = await authService.updateFisherman(user.id, { is_active: !user.is_active });
      setMessage(
        `${updated.full_name} ${updated.is_active ? 'activated' : 'deactivated'}.`
      );
      await fetchFishermen(search.trim() || undefined);
      setTimeout(() => setMessage(null), 6000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to update account state');
    } finally {
      setActionLoading(null);
    }
  };

  const setField = (key: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }) as FormState);
  };

  const inputClass = (hasError?: boolean) =>
    `w-full px-3 py-2 rounded-lg bg-[#03141F] border text-white text-xs outline-none transition-colors placeholder:text-slate-400 focus:border-[#16C7C7] focus-visible:ring-2 focus-visible:ring-[#16C7C7]/60 ${
      hasError ? 'border-red-500/70' : 'border-slate-700'
    }`;

  const labelClass = 'block text-[11px] font-mono font-semibold text-slate-300 mb-1';

  return (
    <section aria-label="Fishermen registry">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-extrabold text-white font-heading flex items-center gap-2">
            <Users className="w-5 h-5 text-[#16C7C7]" />
            <span>Fishermen Registry</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Registered artisanal &amp; mechanized fishermen — admin-managed registrations
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Search name, port, vessel, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search fisherman registry"
              className="pl-8 pr-3 py-2 w-56 rounded-lg bg-[#03141F] border border-slate-700 text-white text-xs outline-none focus:border-[#16C7C7] focus-visible:ring-2 focus-visible:ring-[#16C7C7]/60 placeholder:text-slate-400"
            />
          </div>

          <button
            onClick={() => fetchFishermen(search.trim() || undefined)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#082A36] border border-[#16C7C7]/30 text-[#28D7E5] text-xs font-semibold cursor-pointer hover:bg-[#16C7C7]/15 transition-colors"
            title="Refresh registry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#16C7C7] hover:bg-[#3FE3E3] text-slate-950 text-xs font-bold cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Fisherman</span>
          </button>
        </div>
      </div>

      {/* Status banners */}
      {message && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#36D399] shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Directory table */}
      {loading && fishermen.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-[#16C7C7]" />
          <p className="text-xs font-mono">Loading fisherman registry...</p>
        </div>
      ) : fishermen.length === 0 ? (
        <div className="rounded-2xl ocean-glass border border-slate-800 p-12 text-center text-slate-400">
          <Users className="w-11 h-11 mx-auto mb-3 text-slate-600" />
          <p className="text-base font-semibold text-slate-300">
            {search ? 'No fishermen match this search' : 'No fishermen registered yet'}
          </p>
          <p className="text-xs font-mono mt-1 text-slate-400">
            {search
              ? 'Try a different name, port, vessel or registration number.'
              : 'Use “Register Fisherman” to create the first registration.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl ocean-glass border border-slate-700/80 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#061F2C] text-[10px] uppercase tracking-wider text-slate-200 border-b border-slate-700">
                <tr>
                  <th className="px-5 py-3 font-bold">Fisherman</th>
                  <th className="px-5 py-3 font-bold">Mobile (Alerts)</th>
                  <th className="px-5 py-3 font-bold">Port / Village</th>
                  <th className="px-5 py-3 font-bold">Vessel</th>
                  <th className="px-5 py-3 font-bold">Emergency Contact</th>
                  <th className="px-5 py-3 font-bold">Official ID</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {fishermen.map((f) => {
                  const p = (f.profile || {}) as Record<string, any>;
                  return (
                    <tr key={f.id} className="hover:bg-[#061F2C]/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white">{f.full_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {f.is_verified ? 'Verified' : 'Unverified'} •{' '}
                          {p.preferred_language?.toUpperCase() || 'EN'}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-200">{maskPhone(f.phone_number)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-slate-200">
                          <MapPin className="w-3.5 h-3.5 text-[#16C7C7] shrink-0" />
                          <span>{p.location || '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-slate-200">
                          <Ship className="w-3.5 h-3.5 text-[#28D7E5] shrink-0" />
                          <span>{p.vessel_name || '—'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {p.vessel_registration_number || 'No reg. no.'}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-slate-200">{p.emergency_contact_name || '—'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {p.emergency_contact ? maskPhone(p.emergency_contact) : '—'}
                          {p.emergency_contact_relation ? ` • ${p.emergency_contact_relation}` : ''}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-slate-300">{p.government_id_type || '—'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {p.government_id_number || 'Not provided'}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            f.is_active
                              ? 'bg-emerald-500/20 text-[#36D399] border-emerald-500/40'
                              : 'bg-slate-700/70 text-slate-300 border-slate-600'
                          }`}
                        >
                          {f.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(f)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#082A36] border border-[#16C7C7]/30 text-[#28D7E5] text-[11px] font-semibold cursor-pointer hover:bg-[#16C7C7]/15 transition-colors"
                            title="Edit registration"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => toggleActive(f)}
                            disabled={actionLoading === f.id}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              f.is_active
                                ? 'bg-red-950/60 border-red-500/40 text-red-300 hover:bg-red-900/50'
                                : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
                            }`}
                            title={f.is_active ? 'Deactivate account' : 'Activate account'}
                          >
                            {f.is_active ? (
                              <>
                                <UserX className="w-3 h-3" />
                                <span>Deactivate</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3 h-3" />
                                <span>Activate</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Register / Edit modal */}
      {modalMode && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={modalMode === 'create' ? 'Register fisherman' : 'Edit fisherman registration'}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#061F2C] border border-[#16C7C7]/35 p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-white font-heading flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#16C7C7]" />
                  {modalMode === 'create' ? 'Register Fisherman' : 'Edit Registration'}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {modalMode === 'create'
                    ? 'Creates an active, verified fisherman account'
                    : `Editing ${editingUser?.full_name}`}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close dialog"
                className="p-1.5 rounded-lg bg-[#03141F] border border-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formErrors.submit && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{formErrors.submit}</span>
              </div>
            )}

            {/* Section 1 — identity */}
            <fieldset className="mb-5">
              <legend className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#16C7C7] mb-3">
                1 • Fisherman Details
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className={labelClass} htmlFor="fish-name">Full Name *</label>
                  <input
                    id="fish-name"
                    className={inputClass(!!formErrors.name)}
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    disabled={modalMode === 'edit'}
                    required={modalMode === 'create'}
                  />
                  {formErrors.name && <p className="text-[10px] text-red-300 mt-1">{formErrors.name}</p>}
                </div>

                <div>
                  <label className={labelClass} htmlFor="fish-phone">Mobile Number *</label>
                  <input
                    id="fish-phone"
                    className={inputClass(!!formErrors.phone_number)}
                    value={form.phone_number}
                    onChange={(e) => setField('phone_number', e.target.value)}
                    placeholder="+91 9876543210"
                    disabled={modalMode === 'edit'}
                    required={modalMode === 'create'}
                  />
                  {formErrors.phone_number && (
                    <p className="text-[10px] text-red-300 mt-1">{formErrors.phone_number}</p>
                  )}
                  {modalMode === 'edit' && (
                    <p className="text-[10px] text-slate-400 mt-1">Mobile number is fixed after registration.</p>
                  )}
                </div>

                <div>
                  <label className={labelClass} htmlFor="fish-age">Age *</label>
                  <input
                    id="fish-age"
                    type="number"
                    min={16}
                    max={100}
                    className={inputClass(!!formErrors.age)}
                    value={form.age}
                    onChange={(e) => setField('age', e.target.value)}
                    placeholder="34"
                    required
                  />
                  {formErrors.age && <p className="text-[10px] text-red-300 mt-1">{formErrors.age}</p>}
                </div>

                <div>
                  <label className={labelClass} htmlFor="fish-lang">Preferred Language</label>
                  <select
                    id="fish-lang"
                    className={inputClass()}
                    value={form.preferred_language}
                    onChange={(e) => setField('preferred_language', e.target.value)}
                  >
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.nativeName} ({l.code.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>

            {/* Section 2 — vessel & port */}
            <fieldset className="mb-5">
              <legend className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#16C7C7] mb-3">
                2 • Vessel &amp; Home Port
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="fish-port">Base Port / Coastal Village *</label>
                  <input
                    id="fish-port"
                    className={inputClass(!!formErrors.location)}
                    value={form.location}
                    onChange={(e) => setField('location', e.target.value)}
                    placeholder="e.g. Machilipatnam Fishing Harbour"
                    required
                  />
                  {formErrors.location && <p className="text-[10px] text-red-300 mt-1">{formErrors.location}</p>}
                </div>

                <div>
                  <label className={labelClass} htmlFor="fish-vessel">Vessel Name</label>
                  <input
                    id="fish-vessel"
                    className={inputClass()}
                    value={form.vessel_name}
                    onChange={(e) => setField('vessel_name', e.target.value)}
                    placeholder="e.g. Sri Lakshmi"
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="fish-regno">Vessel Registration No.</label>
                  <input
                    id="fish-regno"
                    className={inputClass()}
                    value={form.vessel_registration_number}
                    onChange={(e) => setField('vessel_registration_number', e.target.value)}
                    placeholder="e.g. IND-AP-02-MM-1024"
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="fish-type">Fishing Type</label>
                  <input
                    id="fish-type"
                    className={inputClass()}
                    value={form.fishing_type}
                    onChange={(e) => setField('fishing_type', e.target.value)}
                    placeholder="e.g. Artisanal / Mechanized trawl"
                  />
                </div>
              </div>
            </fieldset>

            {/* Section 3 — identification & emergency contact */}
            <fieldset className="mb-5">
              <legend className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#16C7C7] mb-3">
                3 • Official ID &amp; Emergency Contact
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className={labelClass} htmlFor="fish-idtype">Government ID Type</label>
                  <select
                    id="fish-idtype"
                    className={inputClass()}
                    value={form.government_id_type}
                    onChange={(e) => setField('government_id_type', e.target.value)}
                  >
                    <option value="">Not provided</option>
                    {GOVERNMENT_ID_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass} htmlFor="fish-idno">Government ID Number</label>
                  <input
                    id="fish-idno"
                    className={inputClass()}
                    value={form.government_id_number}
                    onChange={(e) => setField('government_id_number', e.target.value)}
                    placeholder="e.g. FL-AP-99123"
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="fish-ecname">Emergency Contact Name</label>
                  <input
                    id="fish-ecname"
                    className={inputClass()}
                    value={form.emergency_contact_name}
                    onChange={(e) => setField('emergency_contact_name', e.target.value)}
                    placeholder="e.g. Sita Devi"
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="fish-ecphone">Emergency Contact Number</label>
                  <input
                    id="fish-ecphone"
                    className={inputClass()}
                    value={form.emergency_contact}
                    onChange={(e) => setField('emergency_contact', e.target.value)}
                    placeholder="+91 9876543212"
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="fish-ecrel">Relationship</label>
                  <input
                    id="fish-ecrel"
                    className={inputClass()}
                    value={form.emergency_contact_relation}
                    onChange={(e) => setField('emergency_contact_relation', e.target.value)}
                    placeholder="e.g. Spouse, Parent, Crew"
                  />
                </div>
              </div>
            </fieldset>

            {/* Section 4 — safety & account state */}
            <fieldset className="mb-6">
              <legend className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#16C7C7] mb-3">
                4 • Safety Consent &amp; Account
              </legend>

              <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={form.safety_tracking_consent}
                  onChange={(e) => setField('safety_tracking_consent', e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#16C7C7] cursor-pointer"
                />
                <span>
                  <strong className="text-white">Safety tracking consent</strong> — allows ORCA to share vessel
                  position with search &amp; rescue during an emergency.
                </span>
              </label>

              {modalMode === 'edit' && (
                <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setField('is_active', e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#16C7C7] cursor-pointer"
                  />
                  <span>
                    <strong className="text-white">Account active</strong> — inactive accounts cannot sign in to
                    any ORCA console.
                  </span>
                </label>
              )}
            </fieldset>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-[#16C7C7] hover:bg-[#3FE3E3] text-slate-950 text-xs font-bold cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{modalMode === 'create' ? 'Create Registration' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};

export default FishermenAdminPanel;
