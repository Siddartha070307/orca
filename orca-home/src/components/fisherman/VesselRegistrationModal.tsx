import React, { useState } from 'react';
import { X, Ship, ShieldCheck, Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Vessel, VesselSafetyEquipment, VesselDocument } from '../../types/fisherman';
import { OFFICIAL_LANDING_CENTRES } from '../../services/fishermanStorage';

interface VesselRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (vessel: Vessel) => void;
}

export const VesselRegistrationModal: React.FC<VesselRegistrationModalProps> = ({
  isOpen,
  onClose,
  onRegister
}) => {
  const [activeTab, setActiveTab] = useState<'identity' | 'specs' | 'equipment' | 'documents'>('identity');

  // Form State
  const [name, setName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [callSign, setCallSign] = useState('');
  const [vesselType, setVesselType] = useState<Vessel['vesselType']>('motorized');
  const [category, setCategory] = useState('Motorized FRP Craft');
  const [baseHarbour, setBaseHarbour] = useState(OFFICIAL_LANDING_CENTRES[0].name);
  const [ownerName, setOwnerName] = useState('');
  const [ownerContact, setOwnerContact] = useState('');

  // Specs
  const [overallLength, setOverallLength] = useState(9.5);
  const [beam, setBeam] = useState(2.6);
  const [depth, setDepth] = useState(1.2);
  const [grossTonnage, setGrossTonnage] = useState(4.2);
  const [engineType, setEngineType] = useState('Outboard Marine Engine');
  const [enginePowerHP, setEnginePowerHP] = useState(20);
  const [fuelCapacityLiters, setFuelCapacityLiters] = useState(90);
  const [maxOperatingRangeKm, setMaxOperatingRangeKm] = useState(45);
  const [maxCrewCapacity, setMaxCrewCapacity] = useState(5);
  const [material, setMaterial] = useState<Vessel['material']>('FRP (Fiberglass)');

  // Safety Equipment
  const [equipment, setEquipment] = useState<VesselSafetyEquipment>({
    lifeJackets: true,
    lifeRaft: false,
    firstAidKit: true,
    fireExtinguisher: true,
    radioVHF: true,
    navGps: true,
    distressBeaconEPIRB: false,
    navigationLights: true,
    aisTransponder: false
  });

  // Mock Documents
  const [documents, setDocuments] = useState<VesselDocument[]>([
    {
      id: 'doc_init',
      name: 'Vessel Registration Certificate (eSamudra)',
      category: 'Vessel Registration',
      uploadedDate: new Date().toLocaleDateString('en-GB'),
      verificationStatus: 'PENDING VERIFICATION',
      fileName: 'REG_CERT_PENDING.pdf'
    }
  ]);

  if (!isOpen) return null;

  const toggleEquip = (key: keyof VesselSafetyEquipment) => {
    setEquipment(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newVessel: Vessel = {
      id: `VES-${Math.floor(1000 + Math.random() * 9000)}`,
      name: name || 'Sagara Mitra',
      registrationNumber: registrationNumber || `IND-AP-${Math.floor(10 + Math.random() * 90)}-FSH-2026`,
      callSign: callSign || `VTC-${Math.floor(1000 + Math.random() * 9000)}`,
      vesselType,
      category,
      portOfRegistry: baseHarbour,
      baseHarbour,
      ownerName: ownerName || 'Ravi Kumar',
      ownerContact: ownerContact || '+91 98480 23114',
      overallLength,
      beam,
      depth,
      grossTonnage,
      engineType,
      enginePowerHP,
      fuelType: 'Diesel',
      fuelCapacityLiters,
      maxOperatingRangeKm,
      maxCrewCapacity,
      constructionYear: 2023,
      material,
      fishingMethod: 'Pelagic Gillnetting & Longline',
      targetFish: 'Mackerel, Tuna, Sardine, Ribbonfish',
      permittedArea: 'East Coast Continental Shelf (up to 25 NM)',
      licenseRef: `FSH-LIC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      safetyCertificateStatus: 'VALID',
      safetyEquipment: equipment,
      documents,
      registeredDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    };

    onRegister(newVessel);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="w-full max-w-2xl ocean-glass rounded-2xl shadow-2xl border border-[#16C7C7]/30 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-[#061F2C] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-[#28D7E5]/15 text-[#28D7E5]">
              <Ship className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-heading tracking-wider uppercase">
                Vessel Registry & Seaworthiness Profile
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                DG Shipping / Fisheries Department Maritime Specifications
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

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-[#03141F] shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('identity')}
            className={`flex-1 py-2.5 text-center text-xs font-mono font-semibold transition-colors ${
              activeTab === 'identity' ? 'text-[#28D7E5] border-b-2 border-[#16C7C7]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Identity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('specs')}
            className={`flex-1 py-2.5 text-center text-xs font-mono font-semibold transition-colors ${
              activeTab === 'specs' ? 'text-[#28D7E5] border-b-2 border-[#16C7C7]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Specs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('equipment')}
            className={`flex-1 py-2.5 text-center text-xs font-mono font-semibold transition-colors ${
              activeTab === 'equipment' ? 'text-[#28D7E5] border-b-2 border-[#16C7C7]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            3. Safety Equipment
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`flex-1 py-2.5 text-center text-xs font-mono font-semibold transition-colors ${
              activeTab === 'documents' ? 'text-[#28D7E5] border-b-2 border-[#16C7C7]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            4. Certificates
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'identity' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                    Vessel Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sagara Mitra"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                    Registration Number (IND / State) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="IND-AP-04-MM-2024"
                    value={registrationNumber}
                    onChange={e => setRegistrationNumber(e.target.value)}
                    className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                    Vessel Class
                  </label>
                  <select
                    value={vesselType}
                    onChange={e => setVesselType(e.target.value as any)}
                    className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                  >
                    <option value="motorized">Motorized Craft (5-20 HP)</option>
                    <option value="traditional">Traditional (Non-Motorized)</option>
                    <option value="mechanized">Mechanized Trawler (100+ HP)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                    Category Description
                  </label>
                  <input
                    type="text"
                    placeholder="Fiberglass Fishing Boat"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                    Call Sign (VHF/Radio)
                  </label>
                  <input
                    type="text"
                    placeholder="VTC-9821"
                    value={callSign}
                    onChange={e => setCallSign(e.target.value)}
                    className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                    Base Landing Harbour *
                  </label>
                  <select
                    value={baseHarbour}
                    onChange={e => setBaseHarbour(e.target.value)}
                    className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                  >
                    {OFFICIAL_LANDING_CENTRES.map(c => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                    Owner Name & Phone
                  </label>
                  <input
                    type="text"
                    placeholder="Ravi Kumar (+91 98480 23114)"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'specs' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                    Overall Length (LOA)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={overallLength}
                    onChange={e => setOverallLength(parseFloat(e.target.value))}
                    className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">meters</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                    Beam (Width)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={beam}
                    onChange={e => setBeam(parseFloat(e.target.value))}
                    className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">meters</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                    Hull Material
                  </label>
                  <select
                    value={material}
                    onChange={e => setMaterial(e.target.value as any)}
                    className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                  >
                    <option value="FRP (Fiberglass)">FRP (Fiberglass)</option>
                    <option value="Wood">Wood</option>
                    <option value="Steel">Steel</option>
                    <option value="Composite">Composite</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                    Engine Power (HP)
                  </label>
                  <input
                    type="number"
                    value={enginePowerHP}
                    onChange={e => setEnginePowerHP(parseInt(e.target.value))}
                    className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                    Max Range (km)
                  </label>
                  <input
                    type="number"
                    value={maxOperatingRangeKm}
                    onChange={e => setMaxOperatingRangeKm(parseInt(e.target.value))}
                    className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-heading mb-1">
                    Max Crew Capacity
                  </label>
                  <input
                    type="number"
                    value={maxCrewCapacity}
                    onChange={e => setMaxCrewCapacity(parseInt(e.target.value))}
                    className="w-full bg-[#061F2C] border border-slate-700 text-xs rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#16C7C7]"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'equipment' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-[#082A36]/60 border border-[#16C7C7]/20 text-[11px] text-slate-300 font-mono">
                Mandatory DG Shipping and Coast Guard Safety Equipment Declaration
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'lifeJackets', label: 'Life Jackets (1 per crew member)' },
                  { key: 'lifeRaft', label: 'Inflatable Life Raft' },
                  { key: 'firstAidKit', label: 'Marine First Aid Medical Kit' },
                  { key: 'fireExtinguisher', label: 'Fire Extinguisher (CO2 / Dry Powder)' },
                  { key: 'radioVHF', label: 'VHF Marine Radio (Channel 16)' },
                  { key: 'navGps', label: 'Marine GPS / NavIC Receiver' },
                  { key: 'distressBeaconEPIRB', label: 'Distress Beacon / EPIRB / DAT' },
                  { key: 'navigationLights', label: 'Port/Starboard Navigation Lights' },
                  { key: 'aisTransponder', label: 'AIS Class B Transponder' }
                ].map(item => (
                  <label
                    key={item.key}
                    className="flex items-center space-x-3 p-3 rounded-xl bg-[#061F2C] border border-slate-800 hover:border-slate-700 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={equipment[item.key as keyof VesselSafetyEquipment]}
                      onChange={() => toggleEquip(item.key as keyof VesselSafetyEquipment)}
                      className="w-4 h-4 rounded text-[#16C7C7] accent-[#16C7C7] cursor-pointer"
                    />
                    <span className="text-xs text-slate-200">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="p-4 border-2 border-dashed border-slate-700 hover:border-[#16C7C7] rounded-xl text-center space-y-2 cursor-pointer transition-colors bg-[#061F2C]/40">
                <Upload className="w-8 h-8 text-[#28D7E5] mx-auto" />
                <div className="text-xs font-semibold text-slate-200">
                  Upload Maritime Certificates (eSamudra / Fisheries Dept)
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Supported formats: PDF, JPG, PNG (Max 5MB) • Status marked as PENDING VERIFICATION
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300 font-heading">
                  Associated Certificates ({documents.length})
                </div>
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#061F2C] border border-slate-800 text-xs"
                  >
                    <div className="flex items-center space-x-2.5">
                      <FileText className="w-4 h-4 text-[#16C7C7]" />
                      <div>
                        <div className="font-semibold text-slate-200">{doc.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{doc.fileName} • {doc.uploadedDate}</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30">
                      {doc.verificationStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between shrink-0">
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
              Save Vessel Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
