/**
 * MyFishermanRegistrationModal — fisherman self-service registration editor.
 *
 * Lets an authenticated fisherman review and update their own registration
 * profile (vessel, port, official ID, emergency contact, safety consent)
 * through the server-side endpoint `PUT /auth/fishermen/me/profile`, which is
 * scoped to the session identity — a fisherman can never target another
 * account, and this modal exposes no admin-only fields (name/phone/activation).
 *
 * Distinct from the legacy mock `components/fisherman/FishermanRegistrationModal`
 * (localStorage demo), which remains untouched.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Ship,
  LogIn
} from 'lucide-react';
import {
  authService,
  FishermanProfileUpdate,
  SafeUser
} from '../services/authService';
import { SUPPORTED_LANGUAGES } from '../utils/i18n';

const GOVERNMENT_ID_TYPES = [
  'Aadhaar',
  'Voter ID',
  'Driving Licence',
  'Fishing Licence',
  'Ration Card',
  'Other'
];

const EMPTY_FORM = {
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
  safety_tracking_consent: false
};

type FormState = typeof EMPTY_FORM;

interface FormErrors {
  [key: string]: string;
}

function buildPayload(form: FormState): FishermanProfileUpdate {
  return {
    age: form.age ? Number(form.age) : undefined,
    location: form.location.trim() || undefined,
    vessel_name: form.vessel_name.trim(),
    vessel_registration_number: form.vessel_registration_number.trim(),
    fishing_type: form.fishing_type.trim(),
    preferred_language: form.preferred_language || undefined,
    emergency_contact: form.emergency_contact.trim(),
    government_id_type: form.government_id_type.trim(),
    government_id_number: form.government_id_number.trim(),
    emergency_contact_name: form.emergency_contact_name.trim(),
    emergency_contact_relation: form.emergency_contact_relation.trim(),
    safety_tracking_consent: Boolean(form.safety_tracking_consent)
  };
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  const age = Number(form.age);
  if (!form.age || Number.isNaN(age) || age < 16 || age > 100) {
    errors.age = 'Age must be between 16 and 100 years.';
  }
  if (form.location.trim().length < 2) {
    errors.location = 'Base port / coastal village is required.';
  }
  return errors;
}

interface MyFishermanRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MyFishermanRegistrationModal: React.FC<MyFishermanRegistrationModalProps> = ({
  isOpen,
  onClose
}) => {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSessionExpired(false);
    try {
      const current = await authService.getCurrentUser();
      setUser(current);
      const p = (current.profile || {}) as Record<string, any>;
      setForm({
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
        safety_tracking_consent: Boolean(p.safety_tracking_consent)
      });
    } catch (err: any) {
      if (err?.status === 401) {
        // Session missing/expired — offer sign-in instead of an opaque error.
        setSessionExpired(true);
      } else {
        setLoadError(err.message || 'Failed to load your registration profile.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload fresh profile data each time the dialog opens.
  useEffect(() => {
    if (isOpen) {
      setSaved(false);
      setFormErrors({});
      loadProfile();
    }
  }, [isOpen, loadProfile]);

  const setField = (key: keyof FormState, value: string | boolean) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }) as FormState);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const updated = await authService.updateMyFishermanProfile(buildPayload(form));
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 5000);
    } catch (err: any) {
      if (err?.status === 401) {
        setSessionExpired(true);
      } else {
        setFormErrors({ submit: err.message || 'Saving your registration failed.' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = (hasError?: boolean) =>
    `w-full px-3 py-2 rounded-lg bg-[#03141F] border text-white text-xs outline-none transition-colors placeholder:text-slate-500 focus:border-[#16C7C7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16C7C7]/60 disabled:opacity-60 disabled:cursor-not-allowed ${
      hasError ? 'border-red-500/70' : 'border-slate-700'
    }`;

  const labelClass = 'block text-[11px] font-mono font-semibold text-slate-300 mb-1';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="My fisherman registration"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#061F2C] border border-[#16C7C7]/35 p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-white font-heading flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-[#16C7C7]" />
              My Registration
            </h3>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              {user
                ? `${user.full_name} • ${user.phone_number || 'no mobile on file'}`
                : 'Your fisherman registration profile'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg bg-[#03141F] border border-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-[#16C7C7]/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {sessionExpired ? (
          <div className="py-8 text-center">
            <AlertCircle className="w-10 h-10 text-[#F5B942] mx-auto mb-3" />
            <p className="text-sm text-slate-200 font-semibold mb-1">Your session has expired</p>
            <p className="text-xs text-slate-400 font-mono mb-5">
              Sign in again to review and update your registration.
            </p>
            <Link
              to="/login/fisherman"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#16C7C7] hover:bg-[#3FE3E3] text-slate-950 text-xs font-bold cursor-pointer transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          </div>
        ) : loading ? (
          <div className="py-12 text-center text-slate-400">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-[#16C7C7]" />
            <p className="text-xs font-mono">Loading your registration...</p>
          </div>
        ) : loadError ? (
          <div className="py-8 text-center">
            <AlertCircle className="w-9 h-9 text-red-400 mx-auto mb-3" />
            <p className="text-xs text-red-200 mb-4">{loadError}</p>
            <button
              type="button"
              onClick={loadProfile}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {formErrors.submit && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{formErrors.submit}</span>
              </div>
            )}
            {saved && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#36D399] shrink-0" />
                <span>Registration updated successfully.</span>
              </div>
            )}

            {/* Section 1 — vessel & port */}
            <fieldset className="mb-5">
              <legend className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#16C7C7] mb-3">
                1 • Vessel &amp; Home Port
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className={labelClass} htmlFor="my-age">Age *</label>
                  <input
                    id="my-age"
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
                  <label className={labelClass} htmlFor="my-lang">Preferred Language</label>
                  <select
                    id="my-lang"
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

                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="my-port">Base Port / Coastal Village *</label>
                  <input
                    id="my-port"
                    className={inputClass(!!formErrors.location)}
                    value={form.location}
                    onChange={(e) => setField('location', e.target.value)}
                    placeholder="e.g. Machilipatnam Fishing Harbour"
                    required
                  />
                  {formErrors.location && (
                    <p className="text-[10px] text-red-300 mt-1">{formErrors.location}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass} htmlFor="my-vessel">Vessel Name</label>
                  <input
                    id="my-vessel"
                    className={inputClass()}
                    value={form.vessel_name}
                    onChange={(e) => setField('vessel_name', e.target.value)}
                    placeholder="e.g. Sri Lakshmi"
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="my-regno">Vessel Registration No.</label>
                  <input
                    id="my-regno"
                    className={inputClass()}
                    value={form.vessel_registration_number}
                    onChange={(e) => setField('vessel_registration_number', e.target.value)}
                    placeholder="e.g. IND-AP-02-MM-1024"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="my-type">Fishing Type</label>
                  <input
                    id="my-type"
                    className={inputClass()}
                    value={form.fishing_type}
                    onChange={(e) => setField('fishing_type', e.target.value)}
                    placeholder="e.g. Artisanal / Mechanized trawl"
                  />
                </div>
              </div>
            </fieldset>

            {/* Section 2 — official ID & emergency contact */}
            <fieldset className="mb-5">
              <legend className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#16C7C7] mb-3">
                2 • Official ID &amp; Emergency Contact
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className={labelClass} htmlFor="my-idtype">Government ID Type</label>
                  <select
                    id="my-idtype"
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
                  <label className={labelClass} htmlFor="my-idno">Government ID Number</label>
                  <input
                    id="my-idno"
                    className={inputClass()}
                    value={form.government_id_number}
                    onChange={(e) => setField('government_id_number', e.target.value)}
                    placeholder="e.g. FL-AP-99123"
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="my-ecname">Emergency Contact Name</label>
                  <input
                    id="my-ecname"
                    className={inputClass()}
                    value={form.emergency_contact_name}
                    onChange={(e) => setField('emergency_contact_name', e.target.value)}
                    placeholder="e.g. Sita Devi"
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="my-ecphone">Emergency Contact Number</label>
                  <input
                    id="my-ecphone"
                    className={inputClass()}
                    value={form.emergency_contact}
                    onChange={(e) => setField('emergency_contact', e.target.value)}
                    placeholder="+91 9876543212"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="my-ecrel">Relationship</label>
                  <input
                    id="my-ecrel"
                    className={inputClass()}
                    value={form.emergency_contact_relation}
                    onChange={(e) => setField('emergency_contact_relation', e.target.value)}
                    placeholder="e.g. Spouse, Parent, Crew"
                  />
                </div>
              </div>
            </fieldset>

            {/* Section 3 — safety consent */}
            <fieldset className="mb-6">
              <legend className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#16C7C7] mb-3">
                3 • Safety Consent
              </legend>
              <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.safety_tracking_consent}
                  onChange={(e) => setField('safety_tracking_consent', e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#16C7C7] cursor-pointer"
                />
                <span>
                  <strong className="text-white">Safety tracking consent</strong> — allows ORCA to share
                  your vessel position with search &amp; rescue during an emergency.
                </span>
              </label>
            </fieldset>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-[#16C7C7] hover:bg-[#3FE3E3] text-slate-950 text-xs font-bold cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#16C7C7]/60"
              >
                {saving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Ship className="w-3.5 h-3.5" />
                )}
                <span>Save Changes</span>
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
};

export default MyFishermanRegistrationModal;
