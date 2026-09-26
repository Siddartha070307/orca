import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type LanguageCode = 'en' | 'te' | 'ta' | 'hi' | 'kn' | 'ml' | 'mr' | 'bn' | 'gu' | 'or';

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' }
];

export const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    // Role selection
    'roles.title': 'ORCA MARINE INTELLIGENCE PLATFORM',
    'roles.subtitle': 'Select your operational role to access dedicated marine situational intelligence, surveillance, or scientific analytics.',
    'roles.sihBadge': 'ISRO • SIH 26176',
    'roles.continueAs': 'Continue as',
    'roles.switchRole': 'Switch Role',
    'roles.activeRole': 'Active Role',
    'roles.current': 'Current',

    // Role Fisherman
    'roles.fisherman.title': 'Fisherman / Vessel Operator',
    'roles.fisherman.tier': 'OPERATIONAL TIER',
    'roles.fisherman.desc': 'Near-shore and deep-sea advisory engine with conversational AI, INCOIS PFZ coordinates, sea-state warnings, and 3D simulation.',
    'roles.fisherman.f1': 'Natural language & Indic voice advisory feeds',
    'roles.fisherman.f2': 'INCOIS Potential Fishing Zones (PFZ) & bearing vectors',
    'roles.fisherman.f3': 'Weather risk assessments & multi-channel dispatch',

    // Role Authority
    'roles.authority.title': 'Port Authority & Coast Guard',
    'roles.authority.tier': 'SURVEILLANCE & ENFORCEMENT',
    'roles.authority.desc': 'Surveillance console with high-priority restricted naval & marine sanctuary perimeters, cross-vessel compliance, and threat alerts.',
    'roles.authority.f1': 'Real-time restricted zone geofencing (Karwar, Mannar, Gahirmatha)',
    'roles.authority.f2': 'Cross-sector fleet safety verdicts (UNSAFE / CAUTION priority)',
    'roles.authority.f3': '9-Agent deterministic compliance audit trace',

    // Role Researcher
    'roles.researcher.title': 'Marine Scientist & Oceanographer',
    'roles.researcher.tier': 'EXPLORATORY SCIENTIFIC SUITE',
    'roles.researcher.desc': 'Data-first console with interactive multi-source filters, multi-sector parameter trend explorer, expanded agent reasoning, and raw CSV/PDF export.',
    'roles.researcher.f1': 'Authoritative source filtering (INCOIS, MOSDAC, Copernicus, IMD)',
    'roles.researcher.f2': 'Multi-sector SST, Chlorophyll, Wave, Wind comparison',
    'roles.researcher.f3': 'Comprehensive PFZ matrix & structured data export',

    // Common Nav
    'nav.layers': 'LIVE OCEAN LAYERS',
    'nav.dashboard': 'DASHBOARD',
    'nav.fisherman': 'FISHERMAN',
    'nav.authority': 'AUTHORITY CONSOLE',
    'nav.researcher': 'RESEARCH CONSOLE',
    'nav.3d': '3D SIMULATION',
    'nav.about': 'ABOUT & PROVENANCE',

    // Authority Console
    'auth.heading': 'MARITIME SAFETY & SURVEILLANCE CONSOLE',
    'auth.subheading': 'Directorate General of Shipping • Indian Coast Guard • Marine Police Enforcement Grid',
    'auth.restrictedZones': 'National Restricted & Naval Defense Zones',
    'auth.activeVerdicts': 'Cross-Sector Live Advisory Verdicts',
    'auth.verdictSubtitle': 'Prioritized cross-fleet safety statuses. Caution and Unsafe warnings surfaced to top.',
    'auth.table.sector': 'SECTOR / HARBOUR',
    'auth.table.verdict': 'VERDICT',
    'auth.table.wind': 'WIND SPEED',
    'auth.table.wave': 'WAVE HEIGHT',
    'auth.table.restrictedProximity': 'RESTRICTED BOUNDARY',
    'auth.table.vesselCount': 'VESSELS AT SEA',
    'auth.table.summary': 'OPERATIONAL ADVISORY',
    'auth.table.timestamp': 'UPDATED (IST)',
    'auth.table.actions': 'ACTIONS',
    'auth.inspect': 'Inspect Audit',
    'auth.allClear': 'Clear of Restricted Zones',
    'auth.zoneWarning': 'Proximity Warning (< 15 km)',
    'auth.zoneViolation': 'EXCLUSION ZONE CONFLICT',
    'auth.filterAll': 'All Verdicts',
    'auth.filterHazard': 'Caution & Unsafe Only',
    'auth.systemStatus': 'SURVEILLANCE GRID: ACTIVE',

    // Researcher Console
    'res.heading': 'OCEANOGRAPHIC DATA & REASONING CONSOLE',
    'res.subheading': 'Bio-Thermal Ocean Fronts • Multi-Sensor Satellite Inversions • Deterministic Agent Traces',
    'res.sourcesTitle': 'Authoritative Data Providers (Click to Filter)',
    'res.trendExplorerTitle': 'Multi-Parameter Multi-Sector Trend Explorer',
    'res.trendSubtitle': 'Compare bio-physical ocean parameters across Indian coastal sectors. Zero synthetic fabrication guarantee.',
    'res.pfzTableTitle': 'Cross-Sector Potential Fishing Zone (PFZ) Comparison Matrix',
    'res.pfzTableSubtitle': 'Operational habitat suitability, thermal skin temperature, and bio-optical chlorophyll concentrations.',
    'res.agentReasoningTitle': 'Expanded Collaborative Agent Pipeline Trace',
    'res.agentReasoningSubtitle': 'Deterministic 9-agent reasoning log with confidence scores and verification evidence.',
    'res.exportCsv': 'Export CSV Data',
    'res.exportPdf': 'Export Advisory PDF',
    'res.paramSst': 'Sea Surface Temperature (°C)',
    'res.paramChl': 'Chlorophyll-a (mg/m³)',
    'res.paramWave': 'Significant Wave Height (m)',
    'res.paramWind': 'Surface Marine Wind (km/h)',
    'res.zeroFabNotice': 'Zero-Fabrication Guarantee: Displaying verified operational observation & forecast telemetry. Historical archival data requires backend archive expansion.'
  },
  te: {
    'roles.title': 'ఆర్కా (ORCA) సముద్ర సమాచార వేదిక',
    'roles.subtitle': 'మీ ఆపరేషనల్ రంగాన్ని ఎంచుకుని సమాచారం, పర్యవేక్షణ లేదా పరిశోధన వేదికను పొందండి.',
    'roles.sihBadge': 'ఇస్రో • SIH 26176',
    'roles.continueAs': 'కొనసాగించండి',
    'roles.switchRole': 'పాత్ర మార్చండి',
    'roles.activeRole': 'ప్రస్తుత పాత్ర',
    'roles.current': 'ప్రస్తుతం',
    'roles.fisherman.title': 'మత్స్యకారుడు / పడవ నిర్వాహకుడు',
    'roles.fisherman.tier': 'మత్స్యకార వేదిక',
    'roles.fisherman.desc': 'తీర మరియు లోతైన సముద్ర వేట కోసం వాయిస్ సమాచారం, INCOIS PFZ నిరూపకాలు మరియు 3D అనుకరణ.',
    'roles.authority.title': 'పోర్ట్ అథారిటీ & తీర రక్షక దళం',
    'roles.authority.tier': 'నిఘా మరియు రక్షణ వేదిక',
    'roles.authority.desc': 'రక్షిత నౌకాదళ జోన్లు, సముద్ర జాతీయ పార్కుల నిఘా మరియు భద్రతా హెచ్చరికల నియంత్రణ.',
    'roles.researcher.title': 'సముద్ర శాస్త్రవేత్త & పరిశోధకుడు',
    'roles.researcher.tier': 'శాస్త్రీయ పరిశోధన విభాగం',
    'roles.researcher.desc': 'బహుళ-ఉపగ్రహ డేటా ఫిల్టర్లు, పారామీటర్ గ్రాఫ్‌లు మరియు డేటా ఎగుమతి.',
    'nav.layers': 'సముద్ర పొరలు',
    'nav.dashboard': 'డాష్‌బోర్డ్',
    'nav.fisherman': 'మత్స్యకారుడు',
    'nav.authority': 'రక్షణ వేదిక',
    'nav.researcher': 'పరిశోధన వేదిక',
    'nav.3d': '3D అనుకరణ',
    'nav.about': 'గురించి',
    'auth.heading': 'సముద్ర భద్రత మరియు నిఘా కన్సోల్',
    'res.heading': 'సముద్ర శాస్త్ర డేటా మరియు పరిశోధన వేదిక'
  },
  ta: {
    'roles.title': 'ஆர்கா (ORCA) கடல்சார் புலனாய்வு தளம்',
    'roles.subtitle': 'உங்கள் செயல்பாட்டுப் பிரிவைத் தேர்ந்தெடுத்து கடல்சார் தகவல்களைப் பெறுங்கள்.',
    'roles.sihBadge': 'இஸ்ரோ • SIH 26176',
    'roles.continueAs': 'தொடரவும்',
    'roles.switchRole': 'பங்கை மாற்றவும்',
    'roles.activeRole': 'செயலில் உள்ள பங்கு',
    'roles.current': 'தற்போதைய',
    'roles.fisherman.title': 'மீனவர் / படகு ஆபரேட்டர்',
    'roles.fisherman.tier': 'மீன்பிடி தளம்',
    'roles.fisherman.desc': 'குரல் ஆலோசனைகள், INCOIS PFZ ஒருங்கிணைப்புகள் மற்றும் 3D உருவகப்படுத்துதல்.',
    'roles.authority.title': 'துறைமுக ஆணையம் & கடலோர காவல்படை',
    'roles.authority.tier': 'கண்காணிப்பு மற்றும் அமலாக்க தளம்',
    'roles.authority.desc': 'தடைசெய்யப்பட்ட கடற்படை மண்டலங்கள், கடல்சார் தேசிய பூங்காக்கள் மற்றும் எச்சரிக்கைகள்.',
    'roles.researcher.title': 'கடல்சார் விஞ்ஞானி & ஆராய்ச்சியாளர்',
    'roles.researcher.tier': 'விஞ்ஞான ஆய்வு தளம்',
    'roles.researcher.desc': 'தரவு வழங்குநர் வடிகட்டிகள், பல-துறை போக்கு வரைபடங்கள் மற்றும் தரவு ஏற்றுமதி.',
    'nav.layers': 'கடல் அடுக்குகள்',
    'nav.dashboard': 'டாஷ்போர்டு',
    'nav.fisherman': 'மீனவர்',
    'nav.authority': 'கண்காணிப்பு',
    'nav.researcher': 'ஆராய்ச்சி',
    'nav.3d': '3D உருவகப்படுத்துதல்',
    'nav.about': 'பற்றி',
    'auth.heading': 'கடல்சார் பாதுகாப்பு மற்றும் கண்காணிப்பு பணியகம்',
    'res.heading': 'கடல்சார் தரவு மற்றும் ஆராய்ச்சி பணியகம்'
  },
  hi: {
    'roles.title': 'ओर्का (ORCA) समुद्री आसूचना मंच',
    'roles.subtitle': 'समर्पित समुद्री स्थितिजन्य जानकारी, निगरानी या वैज्ञानिक विश्लेषण के लिए अपनी परिचालन भूमिका चुनें।',
    'roles.sihBadge': 'इसरो • SIH 26176',
    'roles.continueAs': 'आगे बढ़ें',
    'roles.switchRole': 'भूमिका बदलें',
    'roles.activeRole': 'सक्रिय भूमिका',
    'roles.current': 'वर्तमान',
    'roles.fisherman.title': 'मछुआरा / नौका संचालक',
    'roles.fisherman.tier': 'परिचालन स्तर',
    'roles.fisherman.desc': 'संवादात्मक एआई, इनकोइस पीएफजेड निर्देशांक, समुद्री स्थिति चेतावनी और 3डी सिमुलेशन के साथ सलाहकार मंच।',
    'roles.authority.title': 'पत्तन प्राधिकरण एवं तटरक्षक बल',
    'roles.authority.tier': 'निगरानी एवं प्रवर्तन',
    'roles.authority.desc': 'प्रतिबंधित नौसैनिक और समुद्री अभयारण्य परिधि, पोत अनुपालन और खतरे की चेतावनी प्रणाली।',
    'roles.researcher.title': 'समुद्री वैज्ञानिक एवं शोधकर्ता',
    'roles.researcher.tier': 'वैज्ञानिक शोध सूट',
    'roles.researcher.desc': 'बहु-स्रोत फिल्टर, बहु-क्षेत्रीय पैरामीटर रुझान अन्वेषक और रॉ डेटा निर्यात।',
    'nav.layers': 'समुद्री परतें',
    'nav.dashboard': 'डैशबोर्ड',
    'nav.fisherman': 'मछुआरा',
    'nav.authority': 'प्राधिकरण कंसोल',
    'nav.researcher': 'शोध कंसोल',
    'nav.3d': '3डी सिमुलेशन',
    'nav.about': 'के बारे में',
    'auth.heading': 'समुद्री सुरक्षा एवं निगरानी कंसोल',
    'res.heading': 'समुद्र विज्ञान डेटा एवं अनुसंधान कंसोल'
  }
};

interface I18nContextValue {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, defaultText?: string) => string;
}

export const I18nContext = createContext<I18nContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string, defaultText?: string) => defaultText || key
});

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    try {
      const stored = localStorage.getItem('orca_language');
      if (stored && SUPPORTED_LANGUAGES.some(l => l.code === stored)) {
        return stored as LanguageCode;
      }
    } catch (e) {}
    return 'en';
  });

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('orca_language', lang);
    } catch (e) {}
  }, []);

  const t = useCallback(
    (key: string, defaultText?: string): string => {
      const dict = TRANSLATIONS[language];
      if (dict && dict[key]) {
        return dict[key];
      }
      const enDict = TRANSLATIONS.en;
      if (enDict && enDict[key]) {
        return enDict[key];
      }
      return defaultText || key;
    },
    [language]
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
