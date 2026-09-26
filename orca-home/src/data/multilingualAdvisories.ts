// Multilingual Coastal Fishery & Safety Advisories for 10 Indian Maritime Languages

export interface LanguageAdvisory {
  code: string;
  name: string;
  nativeName: string;
  pfzAdvisoryTitle: string;
  pfzAdvisoryBody: string;
  waveAlert: string;
  safeReturnMessage: string;
  emergencyTitle: string;
}

export const MULTILINGUAL_ADVISORIES: Record<string, LanguageAdvisory> = {
  english: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    pfzAdvisoryTitle: 'Potential Fishing Zone & Sea State Advisory',
    pfzAdvisoryBody: 'Abundant fish aggregation detected 31 km off Machilipatnam coast along PFZ Sector 6/7 (Bearing 118° ESE). Thermal-chlorophyll frontal boundary is optimal. Waves expected to rise to 1.8m by afternoon; motorized craft advised to begin return before 15:30 IST.',
    waveAlert: 'High Wave Alert: Significant wave height reaching 2.2m off southern sector. Exercise high caution.',
    safeReturnMessage: 'Safe Return Assistant: Maintain bearing 300° WNW back to Machilipatnam landing centre.',
    emergencyTitle: 'ONE-TOUCH DISTRESS TRANSMISSION (MRCC / COAST GUARD 1554)'
  },
  telugu: {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    pfzAdvisoryTitle: 'చేపల వేట అనుకూల ప్రాంతం (PFZ) మరియు సముద్ర స్థితి సమాచారం',
    pfzAdvisoryBody: 'మచిలీపట్నం తీరం నుండి 31 కి.మీ దూరంలో (బేరింగ్ 118° ESE) చేపల సమృద్ధి ఎక్కువగా ఉన్నట్లు INCOIS ఉపగ్రహ డేటా ధృవీకరించింది. మధ్యాహ్నం 2 గంటల తర్వాత అలల ఎత్తు 1.8 మీటర్లకు పెరిగే అవకాశం ఉంది, కాబట్టి చిన్న పడవలు ముందుగానే తీరానికి చేరుకోవాలి.',
    waveAlert: 'తీవ్ర అలల హెచ్చరిక: దక్షిణ సముద్ర సెక్టార్‌లో అలలు 2.2 మీటర్లకు చేరే అవకాశం ఉంది. అత్యంత జాగ్రత్త వహించండి.',
    safeReturnMessage: 'సురక్షిత తిరుగు ప్రయాణం: మచిలీపట్నం హార్బర్ వైపు 300° WNW దిశలో ప్రయాణించండి.',
    emergencyTitle: 'అత్యవసర రక్షణ సహాయం (తీర రక్షక దళం హెల్ప్‌లైన్ 1554)'
  },
  tamil: {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    pfzAdvisoryTitle: 'மீன்பிடி மண்டல (PFZ) மற்றும் கடல் நிலை அறிக்கை',
    pfzAdvisoryBody: 'மச்சிலிப்பட்டினம் கடற்கரையிலிருந்து 31 கி.மீ தொலைவில் (தாங்கி 118° ESE) மீன்வளம் மிகுந்து காணப்படுகிறது. நண்பகலுக்குப் பின் அலைகள் 1.8 மீட்டர் வரை உயரக்கூடும் என்பதால் சிறிய படகுகள் கரை திரும்புமாறு அறிவுறுத்தப்படுகிறது.',
    waveAlert: 'உயர் அலை எச்சரிக்கை: தென் மண்டலத்தில் அலை உயரம் 2.2 மீட்டரை எட்டும். எச்சரிக்கையுடன் செயல்படவும்.',
    safeReturnMessage: 'பாதுகாப்பான கரை திரும்புதல்: மச்சிலிப்பட்டினம் துறைமுகம் நோக்கி 300° WNW திசையில் திரும்பவும்.',
    emergencyTitle: 'அவசரகால மீட்பு அழைப்பு (இந்திய கடலோர காவல்படை 1554)'
  },
  hindi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    pfzAdvisoryTitle: 'संभावित मत्स्य पालन क्षेत्र (PFZ) एवं समुद्री स्थिति परामर्श',
    pfzAdvisoryBody: 'मछलीपट्टनम तट से 31 किमी दूर (दिशामान 118° ESE) मछली समूह प्रचुर मात्रा में पाया गया है। दोपहर बाद लहरों की ऊंचाई 1.8 मीटर तक बढ़ने की संभावना है, अतः छोटी नौकाओं को समय पर तट पर लौटने की सलाह दी जाती है।',
    waveAlert: 'ऊंची लहरों की चेतावनी: दक्षिणी समुद्री क्षेत्र में 2.2 मीटर तक ऊंची लहरें उठ सकती हैं। सतर्क रहें।',
    safeReturnMessage: 'सुरक्षित वापसी सहायक: मछलीपट्टनम बंदरगाह की ओर 300° WNW दिशा में वापसी करें।',
    emergencyTitle: 'आपातकालीन संकट संदेश (भारतीय तटरक्षक बल 1554)'
  },
  malayalam: {
    code: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    pfzAdvisoryTitle: 'സാധ്യതാ മത്സ്യബന്ധന മേഖല (PFZ) സമുദ്രാവസ്ഥ മുന്നറിയിപ്പ്',
    pfzAdvisoryBody: 'തീരത്തുനിന്ന് 31 കി.മീ അകലെ ശക്തമായ മത്സ്യസാന്നിധ്യം രേഖപ്പെടുത്തിയിട്ടുണ്ട്. ഉച്ചയ്ക്ക് ശേഷം തിരമാലകൾ 1.8 മീറ്റർ വരെ ഉയരാൻ സാധ്യതയുള്ളതിനാൽ വള്ളങ്ങൾ സുരക്ഷിതമായി തീരത്തേക്ക് മടങ്ങുക.',
    waveAlert: 'ഉയർന്ന തിരമാല ജാഗ്രതാ നിർദ്ദേശം: തിരമാലകൾ 2.2 മീറ്റർ വരെ ഉയരാൻ സാധ്യതയുണ്ട്.',
    safeReturnMessage: 'സുരക്ഷിത മടക്കയാത്ര: ഹാർബറിലേക്ക് 300° WNW ദിശയിൽ സഞ്ചരിക്കുക.',
    emergencyTitle: 'തീരദേശ രക്ഷാസേന അടിയന്തര സഹായം (1554)'
  },
  kannada: {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    pfzAdvisoryTitle: 'ಸಂಭಾವ್ಯ ಮೀನುಗಾರಿಕಾ ವಲಯ (PFZ) ಸಾಗರ ಮುನ್ಸೂಚನೆ',
    pfzAdvisoryBody: 'ಕರಾವಳಿಯಿಂದ 31 ಕಿ.ಮೀ ದೂರದಲ್ಲಿ ಮೀನುಗಾರಿಕೆಗೆ ಸೂಕ್ತ ಪರಿಸ್ಥಿತಿ ಇದೆ. ಮಧ್ಯಾಹ್ನದ ನಂತರ ಅಲೆಗಳ ಎತ್ತರ ಹೆಚ್ಚಾಗಲಿದ್ದು, ದೋಣಿಗಳು ಸುರಕ್ಷಿತವಾಗಿ ತೀರಕ್ಕೆ ಹಿಂತಿರುಗಲು ಸೂಚಿಸಲಾಗಿದೆ.',
    waveAlert: 'ಎತ್ತರದ ಅಲೆಗಳ ಎಚ್ಚರಿಕೆ: ದಕ್ಷಿಣ ವಲಯದಲ್ಲಿ ಅಲೆಗಳು 2.2 ಮೀಟರ್ ತಲುಪಬಹುದು.',
    safeReturnMessage: 'ಸುರಕ್ಷಿತ ವಾಪಸಾತಿ: 300° WNW ದಿಕ್ಕಿನಲ್ಲಿ ಹಾರ್ಬರ್‌ಗೆ ಹಿಂತಿರುಗಿ.',
    emergencyTitle: 'ತುರ್ತು ರಕ್ಷಣಾ ಸಂದೇಶ (ಕೋಸ್ಟ್ ಗಾರ್ಡ್ 1554)'
  },
  odia: {
    code: 'or',
    name: 'Odia',
    nativeName: 'ଓଡ଼ିଆ',
    pfzAdvisoryTitle: 'ସମ୍ଭାବ୍ୟ ମତ୍ସ୍ୟ ଶିକାର କ୍ଷେତ୍ର (PFZ) ଓ ସାମୁଦ୍ରିକ ସୂଚନା',
    pfzAdvisoryBody: 'ଉପକୂଳରୁ ୩୧ କିଲୋମିଟର ଦୂରରେ ମାଛ ସମୃଦ୍ଧ କ୍ଷେତ୍ର ଚିହ୍ନଟ ହୋଇଛି। ଅପରାହ୍ନରେ ତରଙ୍ଗ ୧.୮ ମିଟର ପର୍ଯ୍ୟନ୍ତ ବୃଦ୍ଧି ପାଇବା ଆଶଙ୍କା ଥିବାରୁ ଛୋଟ ଡଙ୍ଗାଗୁଡ଼ିକ ଠିକ୍ ସମୟରେ ଫେରିଆସନ୍ତୁ।',
    waveAlert: 'ଉଚ୍ଚ ତରଙ୍ଗ ସତର୍କତା: ସାମୁଦ୍ରିକ କ୍ଷେତ୍ରରେ ତରଙ୍ଗ ୨.୨ ମିଟର ପର୍ଯ୍ୟନ୍ତ ବଢ଼ିପାରେ।',
    safeReturnMessage: 'ନିରାପଦ ପ୍ରତ୍ୟାବର୍ତ୍ତନ: ବନ୍ଦର ଆଡ଼କୁ ୩୦୦° WNW ଦିଗରେ ଫେରନ୍ତୁ।',
    emergencyTitle: 'ଜରୁରୀକାଳୀନ ଉଦ୍ଧାର ସହାୟତା (ତଟରକ୍ଷୀ ବାହିନୀ ୧୫୫୪)'
  },
  bengali: {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    pfzAdvisoryTitle: 'সম্ভাব্য মৎস্য শিকার ক্ষেত্র (PFZ) ও সমুদ্র সতর্কতা',
    pfzAdvisoryBody: 'উপকূল থেকে ৩১ কিমি দূরে প্রচুর মাছের সন্ধান মিলেছে। বিকেলে সমুদ্রের ঢেউ ১.৮ মিটার পর্যন্ত বৃদ্ধি পেতে পারে, তাই ছোট নৌকাগুলিকে সময়মতো উপকূলে ফিরে আসার পরামর্শ দেওয়া হচ্ছে।',
    waveAlert: 'উচ্চ ঢেউ সতর্কতা: দক্ষিণ সমুদ্রে ঢেউয়ের উচ্চতা ২.২ মিটার হতে পারে। সতর্ক থাকুন।',
    safeReturnMessage: 'নিরাপদ প্রত্যাবর্তনের দিকনির্দেশনা: বন্দরের দিকে ৩০০° WNW অভিমুখে ফিরুন।',
    emergencyTitle: 'জরুরি উদ্ধার বার্তা (কোস্ট গার্ড হেল্পলাইন ১৫৫৪)'
  },
  marathi: {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    pfzAdvisoryTitle: 'संभाव्य मत्स्य व्यवसाय क्षेत्र (PFZ) व सागरी हवामान अंदाज',
    pfzAdvisoryBody: 'किनाऱ्यापासून ३१ किमी अंतरावर माशांचे मुबलक प्रमाण आढळले आहे. दुपारनंतर लाटांची उंची १.८ मीटरपर्यंत वाढण्याची शक्यता असल्याने लहान बोटींनी वेळेत किनाऱ्यावर परतावे.',
    waveAlert: 'उंच लाटांचा इशारा: समुद्रात लाटा २.२ मीटरपर्यंत उसळू शकतात. दक्षता बाळगा.',
    safeReturnMessage: 'सुरक्षित परतीचा मार्ग: बंदराकडे ३००° WNW दिशेने प्रवास करा.',
    emergencyTitle: 'तातडीची मदत संदेश प्रणाली (तटरक्षक दल १५५४)'
  },
  gujarati: {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    pfzAdvisoryTitle: 'સંભવિત મત્સ્ય ઉદ્યોગ ઝોન (PFZ) અને સમુદ્ર સ્થિતિ સલાહ',
    pfzAdvisoryBody: 'દરિયાકિનારેથી ૩૧ કિમી દૂર પુષ્કળ માછલીઓ મળી આવવાની શક્યતા છે. બપોર પછી મોજાં ૧.૮ મીટર સુધી વધવાની સંભાવના હોવાથી નાની બોટોએ સમયસર પરત ફરવું.',
    waveAlert: 'ઊંચા મોજાંની ચેતવણી: દરિયામાં મોજાં ૨.૨ મીટર સુધી પહોંચી શકે છે. સાવચેત રહો.',
    safeReturnMessage: 'સલામત પરત આવવાની સલાહ: બંદર તરફ ૩૦૦° WNW દિશામાં આગળ વધો.',
    emergencyTitle: 'ઇમરજન્સી બચાવ સહાય (ઇન્ડિયન કોસ્ટ ગાર્ડ ૧૫૫૪)'
  }
};
