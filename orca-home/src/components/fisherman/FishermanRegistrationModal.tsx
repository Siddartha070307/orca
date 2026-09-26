import React, { useState } from 'react';
import { X, User, ShieldCheck, Phone, MapPin, CheckCircle2 } from 'lucide-react';
import { Fisherman } from '../../types/fisherman';
import { OFFICIAL_LANDING_CENTRES } from '../../services/fishermanStorage';

interface FishermanRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (fisherman: Fisherman) => void;
}

export const FishermanRegistrationModal: React.FC<FishermanRegistrationModalProps> = ({
  isOpen,
  onClose,
  onRegister
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fullName, setFullName] = useState('');
  const [idType, setIdType] = useState<Fisherman['idType']>('Fisherman Biometric Card');
  const [rawIdNumber, setRawIdNumber] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState('');
  const [relationship, setRelationship] = useState('Spouse');
  const [homeHarbour, setHomeHarbour] = useState(OFFICIAL_LANDING_CENTRES[0].name);
  const [preferredLanguage, setPreferredLanguage] = useState('telugu');

  if (!isOpen) return null;

  // Mask ID: e.g. "123456789012" -> "XXXX-XXXX-9012"
  const getMaskedId = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (clean.length < 4) return clean;
    const last4 = clean.slice(-4);
    return `XXXX-XXXX-${last4}`;
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep((step + 1) as 2 | 3);
    } else {
      // Create registered fisherman
      const newFisherman: Fisherman = {
        id: `FISH-${Math.floor(10000 + Math.random() * 90000)}`,
        fullName: fullName || 'K. Satyanarayana',
        idType,
        idNumberMasked: getMaskedId(rawIdNumber || '883921004821'),
        mobileNumber: mobileNumber || '+91 98480 11223',
        emergencyContactName: `${emergencyContactName || 'Lakshmi'} (${relationship})`,
        emergencyContactNumber: emergencyContactNumber || '+91 98480 99887',
        homeHarbour,
        state: 'Andhra Pradesh',
        district: 'Krishna District',
        preferredLanguage,
        registeredDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        totalSessions: 0
      };

      onRegister(newFisherman);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="w-full max-w-xl ocean-glass rounded-2xl shadow-2xl border border-[#16C7C7]/30 overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-[#061F2C] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-[#16C7C7]/15 text-[#28D7E5]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-heading tracking-wider uppercase">
                Fisherman Session Registration
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Step {step} of 3 • Maritime Identity & Emergency Verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-Step Progress Bar */}
        <div className="flex border-b border-slate-800 bg-[#03141F]">
          <div
            className={`flex-1 py-2 text-center text-[11px] font-mono font-semibold ${
              step >= 1 ? 'text-[#28D7E5] border-b-2 border-[#16C7C7]' : 'text-slate-500'
            }`}
          >
            1. Identity
          </div>
          <div
            className={`flex-1 py-2 text-center text-[11px] font-mono font-semibold ${
              step >= 2 ? 'text-[#28D7E5] border-b-2 border-[#16C7C7]' : 'text-slate-500'
            }`}
          >
            2. Emergency Contacts
          </div>
          <div
            className={`flex-1 py-2 text-center text-[11px] font-mono font-semibold ${
              step >= 3 ? 'text-[#28D7E5] border-b-2 border-[#16C7C7]' : 'text-slate-500'
            }`}
          >
            3. Base Harbour
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleNext} className="p-6 space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                  Full Name (as per Govt ID) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ravi Kumar"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                    Official Government ID Type *
                  </label>
                  <select
                    value={idType}
                    onChange={e => setIdType(e.target.value as any)}
                    className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                  >
                    <option value="Fisherman Biometric Card">Fisherman Biometric Card</option>
                    <option value="Aadhaar">Aadhaar (UIDAI)</option>
                    <option value="Voter ID">Voter ID (Election Commission)</option>
                    <option value="Kisan Credit Card">Kisan Credit Card (Fisheries)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                    ID Number * (Masked in UI)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter 12-digit number"
                    value={rawIdNumber}
                    onChange={e => setRawIdNumber(e.target.value)}
                    className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                  />
                  {rawIdNumber && (
                    <div className="text-[10px] text-[#36D399] font-mono mt-1">
                      Protected preview: {getMaskedId(rawIdNumber)}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                    Mobile Number (for NavIC/SMS alerts) *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98480 23114"
                    value={mobileNumber}
                    onChange={e => setMobileNumber(e.target.value)}
                    className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                    Preferred Language
                  </label>
                  <select
                    value={preferredLanguage}
                    onChange={e => setPreferredLanguage(e.target.value)}
                    className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                  >
                    <option value="telugu">తెలుగు (Telugu)</option>
                    <option value="tamil">தமிழ் (Tamil)</option>
                    <option value="english">English</option>
                    <option value="hindi">हिन्दी (Hindi)</option>
                    <option value="malayalam">മലയാളം (Malayalam)</option>
                    <option value="kannada">ಕನ್ನಡ (Kannada)</option>
                    <option value="odia">ଓଡ଼ିଆ (Odia)</option>
                    <option value="bengali">বাংলা (Bengali)</option>
                    <option value="marathi">मराठी (Marathi)</option>
                    <option value="gujarati">ગુજરાતી (Gujarati)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-[#082A36]/60 border border-[#16C7C7]/20 text-[11px] text-slate-300 font-mono flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-[#36D399] shrink-0" />
                <span>Emergency contacts receive automatic alerts if communication is lost or a sea safety alert is triggered.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                  Primary Emergency Contact Person Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lakshmi Kumar"
                  value={emergencyContactName}
                  onChange={e => setEmergencyContactName(e.target.value)}
                  className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                    Relationship
                  </label>
                  <select
                    value={relationship}
                    onChange={e => setRelationship(e.target.value)}
                    className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                  >
                    <option value="Spouse">Spouse</option>
                    <option value="Father / Mother">Father / Mother</option>
                    <option value="Brother / Sister">Brother / Sister</option>
                    <option value="Fisheries Society Head">Fisheries Society Head</option>
                    <option value="Harbour Co-operative">Harbour Co-operative</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                    Emergency Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98480 55912"
                    value={emergencyContactNumber}
                    onChange={e => setEmergencyContactNumber(e.target.value)}
                    className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                  Registered Base Harbour / Landing Centre *
                </label>
                <select
                  value={homeHarbour}
                  onChange={e => setHomeHarbour(e.target.value)}
                  className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                >
                  {OFFICIAL_LANDING_CENTRES.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.state})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-4 rounded-xl bg-[#082A36]/40 border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Maritime Jurisdiction:</span>
                  <span className="text-white font-bold">Andhra Pradesh / East Coast EEZ</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Emergency VHF Monitor:</span>
                  <span className="text-[#36D399] font-bold">Channel 16 / 08 Active</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Coast Guard MRCC Toll-Free:</span>
                  <span className="text-[#FF4D5A] font-bold">1554</span>
                </div>
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((step - 1) as 1 | 2)}
                className="px-4 py-2 rounded-xl text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-heading font-bold bg-[#16C7C7] hover:bg-[#28D7E5] text-slate-900 transition-all shadow-lg shadow-[#16C7C7]/20 cursor-pointer"
              >
                {step === 3 ? 'Complete Registration' : 'Continue →'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
