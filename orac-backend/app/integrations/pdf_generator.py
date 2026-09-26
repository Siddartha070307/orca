"""PDF report generator for ORCA Marine Intelligence advisories.

Uses ReportLab to build a professional, localized PDF document with:
- ORCA branding and safety verdict badge
- High-resolution custom vector mini-map canvas (vessel origin, PFZ pin, nav course, restricted zone)
- Localized Indic text rendering via universal Nirmala UI font
- Structured weather, oceanographic, and geospatial telemetry tables
"""
import io
import os
import re
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.graphics.shapes import Drawing, Rect, Circle, Line, Polygon, String, Group
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

logger = logging.getLogger(__name__)

# Register Universal Indic Font (Nirmala UI) if present on Windows / Linux
FONT_NAME = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

FONT_CANDIDATES = [
    ("Nirmala", "C:/Windows/Fonts/Nirmala.ttf", "C:/Windows/Fonts/NirmalaB.ttf"),
    ("Nirmala", "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf", "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf")
]

for name, regular_path, bold_path in FONT_CANDIDATES:
    if os.path.exists(regular_path):
        try:
            pdfmetrics.registerFont(TTFont(name, regular_path))
            FONT_NAME = name
            if os.path.exists(bold_path):
                pdfmetrics.registerFont(TTFont(f"{name}-Bold", bold_path))
                FONT_BOLD = f"{name}-Bold"
            else:
                FONT_BOLD = name
            logger.info(f"Registered PDF font: {FONT_NAME}")
            break
        except Exception as e:
            logger.warning(f"Could not register font {regular_path}: {e}")


# Localized terminology dictionary for PDF chrome
PDF_I18N = {
    "en": {
        "title": "ORCA Marine Intelligence Advisory",
        "subtitle": "Marine Ecosystem Reasoning with Collaborative Agents • ISRO / INCOIS",
        "verdict_label": "SAFETY VERDICT",
        "summary_heading": "Executive Safety Summary",
        "report_heading": "Advisory Report & Operational Guidance",
        "telemetry_heading": "Oceanographic & Atmospheric Telemetry",
        "map_heading": "Geospatial Situational Awareness (Vector Map)",
        "vessel_origin": "Vessel / Port Origin",
        "pfz_label": "Recommended PFZ",
        "nav_course": "Navigational Vector",
        "restricted_label": "Restricted Sanctuary Boundary",
        "param_location": "Evaluated Location",
        "param_wind": "Wind Speed & Gusts",
        "param_wave": "Significant Wave Height",
        "param_sst": "Sea Surface Temp (SST)",
        "param_chlorophyll": "Chlorophyll-a",
        "param_distance": "Distance to PFZ",
        "param_bearing": "Compass Bearing",
        "param_restricted": "Restricted Zone Status",
        "footer_disclaimer": "Advisory generated deterministically via multi-source synthesis. Coastal authorities urge craft to verify live VHF advisories before departure."
    },
    "te": {
        "title": "ఓర్కా సముద్ర భద్రతా సలహా నివేదిక",
        "subtitle": "సహకార ఏజెంట్లతో సముద్ర పర్యావరణ వ్యవస్థ విశ్లేషణ • ISRO / INCOIS",
        "verdict_label": "భద్రతా తీర్పు",
        "summary_heading": "భద్రతా సారాంశం",
        "report_heading": "వివరమైన సలహా నివేదిక మరియు మార్గదర్శకాలు",
        "telemetry_heading": "వాతావరణం మరియు సముద్ర టెలిమెట్రీ",
        "map_heading": "సముద్ర భౌగోళిక పటం (వెక్టార్ మ్యాప్)",
        "vessel_origin": "పడవ / బయలుదేరే తీరం",
        "pfz_label": "చేపల లభ్యత కేంద్రం (PFZ)",
        "nav_course": "నావిగేషన్ మార్గం",
        "restricted_label": "నిషేధిత నావికా సరిహద్దు",
        "param_location": "పరిశీలించిన ప్రాంతం",
        "param_wind": "గాలి వేగం & తీవ్రత",
        "param_wave": "అలల ఎత్తు",
        "param_sst": "సముద్ర ఉపరితల ఉష్ణోగ్రత (SST)",
        "param_chlorophyll": "క్లోరోఫిల్ సాంద్రత",
        "param_distance": "PFZ దూరం",
        "param_bearing": "దిక్సూచి దిశ",
        "param_restricted": "రక్షిత సరిహద్దు స్థితి",
        "footer_disclaimer": "ఓర్కా వ్యవస్థ ద్వారా నివేదిక రూపొందించబడింది. ప్రయాణానికి ముందు లైవ్ సమాచారాన్ని పరిశీలించండి."
    },
    "hi": {
        "title": "ओर्का समुद्री सुरक्षा सलाह रिपोर्ट",
        "subtitle": "सहयोगी एजेंटों के साथ समुद्री पारिस्थितिकी तंत्र विश्लेषण • ISRO / INCOIS",
        "verdict_label": "सुरक्षा निर्णय",
        "summary_heading": "सुरक्षा सारांश",
        "report_heading": "विस्तृत समुद्री सलाह एवं परिचालन निर्देश",
        "telemetry_heading": "मौसम एवं समुद्री टेलीमेट्री",
        "map_heading": "समुद्री भौगोलिक स्थिति (वेक्टर मानचित्र)",
        "vessel_origin": "नाव / प्रस्थान बंदरगाह",
        "pfz_label": "मत्स्य पालन संभावित क्षेत्र (PFZ)",
        "nav_course": "नौवहन मार्ग",
        "restricted_label": "प्रतिबंधित नौसैनिक सीमा",
        "param_location": "मूल्यांकित स्थान",
        "param_wind": "हवा की गति एवं झोंके",
        "param_wave": "लहरों की ऊंचाई",
        "param_sst": "समुद्री सतह तापमान (SST)",
        "param_chlorophyll": "क्लोरोफिल सांद्रता",
        "param_distance": "PFZ तक दूरी",
        "param_bearing": "कम्पास दिशा",
        "param_restricted": "प्रतिबंधित क्षेत्र स्थिति",
        "footer_disclaimer": "ओर्का बहु-स्रोत विश्लेषण द्वारा तैयार। प्रस्थान से पूर्व स्थानीय तटीय चेतावनियों की पुष्टि करें।"
    },
    "kn": {
        "title": "ಓರ್ಕಾ ಸಾಗರ ಸುರಕ್ಷತಾ ಸಲಹಾ ವರದಿ",
        "subtitle": "ಸಹಕಾರಿ ಏಜೆಂಟರೊಂದಿಗೆ ಸಾಗರ ಪರಿಸರ ವಿಶ್ಲೇಷಣೆ • ISRO / INCOIS",
        "verdict_label": "ಸುರಕ್ಷತಾ ತೀರ್ಪು",
        "summary_heading": "ಸುರಕ್ಷತಾ ಸಾರಾಂಶ",
        "report_heading": "ವಿವರವಾದ ಸಲಹಾ ವರದಿ",
        "telemetry_heading": "ಹವಾಮಾನ ಮತ್ತು ಸಾಗರ ಟೆಲಿಮೆಟ್ರಿ",
        "map_heading": "ಸಾಗರ ನಕ್ಷೆ",
        "vessel_origin": "ದೋಣಿ ಮೂಲ",
        "pfz_label": "ಮೀನುಗಾರಿಕಾ ವಲಯ (PFZ)",
        "nav_course": "ನ್ಯಾವಿಗೇಷನ್ ದಿಕ್ಕು",
        "restricted_label": "ನಿರ್ಬಂಧಿತ ಗಡಿ",
        "param_location": "ಸ್ಥಳ",
        "param_wind": "ಗಾಳಿಯ ವೇಗ",
        "param_wave": "ಅಲೆಗಳ ಎತ್ತರ",
        "param_sst": "ಸಮುದ್ರ ತಾಪಮಾನ",
        "param_chlorophyll": "ಕ್ಲೋರೊಫಿಲ್",
        "param_distance": "ದೂರ",
        "param_bearing": "ದಿಕ್ಕು",
        "param_restricted": "ನಿರ್ಬಂಧಿತ ಸ್ಥಿತಿ",
        "footer_disclaimer": "ಪ್ರಯಾಣಿಸುವ ಮುನ್ನ ಲೈವ್ ಸುರಕ್ಷತಾ ಮಾಹಿತಿಯನ್ನು ಪರಿಶೀಲಿಸಿ."
    },
    "ta": {
        "title": "ஆர்கா கடல்சார் பாதுகாப்பு அறிக்கை",
        "subtitle": "கூட்டு முகவர்களுடன் கடல் சூழலியல் பகுப்பாய்வு • ISRO / INCOIS",
        "verdict_label": "பாதுகாப்பு தீர்ப்பு",
        "summary_heading": "பாதுகாப்பு சுருக்கம்",
        "report_heading": "முழுமையான ஆலோசனை அறிக்கை",
        "telemetry_heading": "வானிலை & கடல் தொலை அளவியல்",
        "map_heading": "கடல்சார் வரைபடம்",
        "vessel_origin": "படகு புறப்படும் இடம்",
        "pfz_label": "மீன்பிடி மண்டலம் (PFZ)",
        "nav_course": "திசையமைப்பு",
        "restricted_label": "தடைசெய்யப்பட்ட எல்லை",
        "param_location": "மதிப்பிடப்பட்ட இடம்",
        "param_wind": "காற்றின் வேகம்",
        "param_wave": "அலை உயரம்",
        "param_sst": "கடல் மேற்பரப்பு வெப்பநிலை",
        "param_chlorophyll": "குளோரோபில்",
        "param_distance": "தூரம்",
        "param_bearing": "திசை",
        "param_restricted": "தடைசெய்யப்பட்ட நிலை",
        "footer_disclaimer": "கடலுக்குச் செல்லும் முன் நேரலை எச்சரிக்கைகளைச் சரிபார்க்கவும்."
    },
    "ml": {
        "title": "ഓർക്ക സമുദ്ര സുരക്ഷാ മുന്നറിയിപ്പ് റിപ്പോർട്ട്",
        "subtitle": "സഹകരണ ഏജന്റുകളുടെ സമുദ്ര വിവര വിശകലനം • ISRO / INCOIS",
        "verdict_label": "സുരക്ഷാ വിധി",
        "summary_heading": "സുരക്ഷാ സംഗ്രഹം",
        "report_heading": "വിശദമായ ഉപദേശക റിപ്പോർട്ട്",
        "telemetry_heading": "കാലാവസ്ഥാ & സമുദ്ര വിവരങ്ങൾ",
        "map_heading": "സമുദ്ര ഭൂപടം",
        "vessel_origin": "ബോട്ട് പുറപ്പെടുന്ന സ്ഥലം",
        "pfz_label": "മത്സ്യലഭ്യതാ മേഖല (PFZ)",
        "nav_course": "ദിശാ സൂചിക",
        "restricted_label": "നിരോധിത നാവിക മേഖല",
        "param_location": "സ്ഥലം",
        "param_wind": "കാറ്റിന്റെ വേഗത",
        "param_wave": "തിരമാല ഉയരം",
        "param_sst": "സമുദ്ര താപനില",
        "param_chlorophyll": "ക്ലോറോഫിൽ",
        "param_distance": "ദൂരം",
        "param_bearing": "ദിശ",
        "param_restricted": "സുരക്ഷാ മേഖല",
        "footer_disclaimer": "യാത്ര പുറപ്പെടുന്നതിന് മുൻപ് സുരക്ഷാ നിർദ്ദേശങ്ങൾ പരിശോധിക്കുക."
    },
    "mr": {
        "title": "ऑर्का सागरी सुरक्षा सल्लागार अहवाल",
        "subtitle": "सहयोगी एजंट्सद्वारे सागरी डेटा विश्लेषण • ISRO / INCOIS",
        "verdict_label": "सुरक्षा निकाल",
        "summary_heading": "सुरक्षा सारांश",
        "report_heading": "तपशीलवार सल्लागार अहवाल",
        "telemetry_heading": "हवामान आणि सागरी माहिती",
        "map_heading": "सागरी नकाशा",
        "vessel_origin": "बोट प्रस्थान बिंदू",
        "pfz_label": "संभाव्य मत्स्य क्षेत्र (PFZ)",
        "nav_course": "नेव्हिगेशन दिशा",
        "restricted_label": "प्रतिबंधित क्षेत्र",
        "param_location": "स्थान",
        "param_wind": "वाऱ्याचा वेग",
        "param_wave": "लाटांची उंची",
        "param_sst": "सागरी तापमान",
        "param_chlorophyll": "क्लोरोफिल",
        "param_distance": "अंतर",
        "param_bearing": "दिशा",
        "param_restricted": "प्रतिबंधित स्थिती",
        "footer_disclaimer": "समुद्रात जाण्यापूर्वी स्थानिक हवामान सूचनांची पडताळणी करा."
    },
    "bn": {
        "title": "অর্কা সামুদ্রিক সুরক্ষা পরামর্শ প্রতিবেদন",
        "subtitle": "সহযোগী এজেন্টের সাহায্যে সামুদ্রিক বিশ্লেষণ • ISRO / INCOIS",
        "verdict_label": "সুরক্ষা রায়",
        "summary_heading": "সুরক্ষা সারসংক্ষেপ",
        "report_heading": "বিস্তারিত পরামর্শ প্রতিবেদন",
        "telemetry_heading": "আবহাওয়া ও সামুদ্রিক টেলিমেট্রি",
        "map_heading": "সামুদ্রিক মানচিত্র",
        "vessel_origin": "নৌকা উৎসস্থল",
        "pfz_label": "সম্ভাব্য মৎস্য ক্ষেত্র (PFZ)",
        "nav_course": "দিকনির্দেশ",
        "restricted_label": "নিষিদ্ধ এলাকা",
        "param_location": "স্থান",
        "param_wind": "বাতাসের গতিবেগ",
        "param_wave": "ঢেউয়ের উচ্চতা",
        "param_sst": "সমুদ্রপৃষ্ঠের তাপমাত্রা",
        "param_chlorophyll": "ক্লোরোফিল",
        "param_distance": "দূরত্ব",
        "param_bearing": "কম্পাস কোণ",
        "param_restricted": "সীমাবদ্ধ অবস্থা",
        "footer_disclaimer": "যাত্রার আগে তাজা আবহাওয়া বার্তা যাচাই করুন।"
    },
    "gu": {
        "title": "ઓર્કા દરિયાઈ સુરક્ષા સલાહકાર અહેવાલ",
        "subtitle": "સહયોગી એજન્ટો દ્વારા દરિયાઈ પૃથ્થકરણ • ISRO / INCOIS",
        "verdict_label": "સુરક્ષા નિર્ણય",
        "summary_heading": "સુરક્ષા સારાંશ",
        "report_heading": "વિગતવાર સલાહ અહેવાલ",
        "telemetry_heading": "હવામાન અને દરિયાઈ વિગતો",
        "map_heading": "દરિયાઈ નકશો",
        "vessel_origin": "બોટ મૂળ સ્થાન",
        "pfz_label": "સંભવિત મત્સ્ય ઝોન (PFZ)",
        "nav_course": "દિશામાન",
        "restricted_label": "પ્રતિબંધિત ક્ષેત્ર",
        "param_location": "સ્થળ",
        "param_wind": "પવનની ગતિ",
        "param_wave": "મોજાની ઊંચાઈ",
        "param_sst": "દરિયાઈ તાપમાન",
        "param_chlorophyll": "ક્લોરોફિલ",
        "param_distance": "અંતર",
        "param_bearing": "દિશા",
        "param_restricted": "પ્રતિબંધિત સ્થિતિ",
        "footer_disclaimer": "પ્રસ્થાન પહેલાં હવામાન માહિતી ચકાસી લેવી."
    },
    "or": {
        "title": "ଓର୍କା ସାମୁଦ୍ରିକ ସୁରକ୍ଷା ପରାମର୍ଶ ରିପୋର୍ଟ",
        "subtitle": "ସହଯୋଗୀ ଏଜେଣ୍ଟ ଦ୍ୱାରା ସାମୁଦ୍ରିକ ବିଶ୍ଳେଷଣ • ISRO / INCOIS",
        "verdict_label": "ସୁରକ୍ଷା ନିଷ୍ପତ୍ତି",
        "summary_heading": "ସୁରକ୍ଷା ସାରାଂଶ",
        "report_heading": "ବିସ୍ତୃତ ପରାମର୍ଶ ରିପୋର୍ଟ",
        "telemetry_heading": "ପାଣିପାଗ ଏବଂ ସାମୁଦ୍ରିକ ତଥ୍ୟ",
        "map_heading": "ସାମୁଦ୍ରିକ ମାନଚିତ୍ର",
        "vessel_origin": "ଡଙ୍ଗା ପ୍ରସ୍ଥାନ ସ୍ଥାନ",
        "pfz_label": "ସମ୍ଭାବ୍ୟ ମତ୍ସ୍ୟ କ୍ଷେତ୍ର (PFZ)",
        "nav_course": "ଦିଗ",
        "restricted_label": "ନିଷିଦ୍ଧ ସୀମା",
        "param_location": "ସ୍ଥାନ",
        "param_wind": "ପବନର ବେଗ",
        "param_wave": "ତରଙ୍ଗ ଉଚ୍ଚତା",
        "param_sst": "ସମୁଦ୍ର ତାପମାତ୍ରା",
        "param_chlorophyll": "କ୍ଲୋରୋଫିଲ",
        "param_distance": "ଦୂରତା",
        "param_bearing": "ଦିଗ",
        "param_restricted": "ନିଷିଦ୍ଧ ସ୍ଥିତି",
        "footer_disclaimer": "ଯାତ୍ରା ପୂର୍ବରୁ ସର୍ବଶେଷ ପାଣିପାଗ ବାର୍ତ୍ତା ଯାଞ୍ଚ କରନ୍ତୁ।"
    },
    "pa": {
        "title": "ਓਰਕਾ ਸਮੁੰਦਰੀ ਸੁਰੱਖਿਆ ਸਲਾਹ ਰਿਪੋਰਟ",
        "subtitle": "ਸਹਿਯੋਗੀ ਏਜੰਟਾਂ ਦੁਆਰਾ ਸਮੁੰਦਰੀ ਵਿਸ਼ਲੇਸ਼ਣ • ISRO / INCOIS",
        "verdict_label": "ਸੁਰੱਖਿਆ ਫੈਸਲਾ",
        "summary_heading": "ਸੁਰੱਖਿਆ ਸਾਰਾਂਸ਼",
        "report_heading": "ਵਿਸਤ੍ਰਿਤ ਸਲਾਹ ਰਿਪੋਰਟ",
        "telemetry_heading": "ਮੌਸਮ ਅਤੇ ਸਮੁੰਦਰੀ ਟੈਲੀਮੈਟਰੀ",
        "map_heading": "ਸਮੁੰਦਰੀ ਨਕਸ਼ਾ",
        "vessel_origin": "ਕਿਸ਼ਤੀ ਮੂਲ",
        "pfz_label": "ਸੰਭਾਵੀ ਮੱਛੀ ਖੇਤਰ (PFZ)",
        "nav_course": "ਦਿਸ਼ਾ",
        "restricted_label": "ਪਾਬੰਦੀਸ਼ੁਦਾ ਖੇਤਰ",
        "param_location": "ਸਥਾਨ",
        "param_wind": "ਹਵਾ ਦੀ ਗਤੀ",
        "param_wave": "ਲਹਿਰਾਂ ਦੀ ਉਚਾਈ",
        "param_sst": "ਸਮੁੰਦਰ ਦਾ ਤਾਪਮਾਨ",
        "param_chlorophyll": "ਕਲੋਰੋਫਿਲ",
        "param_distance": "ਦੂਰੀ",
        "param_bearing": "ਦਿਸ਼ਾ",
        "param_restricted": "ਪਾਬੰਦੀ ਸਥਿਤੀ",
        "footer_disclaimer": "ਸਮੁੰਦਰ ਜਾਣ ਤੋਂ ਪਹਿਲਾਂ ਤਾਜ਼ਾ ਸਲਾਹ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ।"
    },
    "as": {
        "title": "অৰ্কা সামুদ্ৰিক সুৰক্ষা পৰামৰ্শ প্ৰতিবেদন",
        "subtitle": "সহযোগী এজেণ্টৰ দ্বাৰা সামুদ্ৰিক বিশ্লেষণ • ISRO / INCOIS",
        "verdict_label": "সুৰক্ষা সিদ্ধান্ত",
        "summary_heading": "সুৰক্ষা সাৰাংশ",
        "report_heading": "বিস্তাৰিত পৰামৰ্শ প্ৰতিবেদন",
        "telemetry_heading": "বতৰ আৰু সামুদ্ৰিক তথ্য",
        "map_heading": "সামুদ্ৰিক মানচিত্ৰ",
        "vessel_origin": "নাও মূল",
        "pfz_label": "সম্ভাৱ্য মৎস্য মণ্ডল (PFZ)",
        "nav_course": "দিশ নিৰ্ণয়",
        "restricted_label": "নিষিদ্ধ মণ্ডল",
        "param_location": "স্থান",
        "param_wind": "বতাহৰ গতি",
        "param_wave": "ঢৌৰ উচ্চতা",
        "param_sst": "সাগৰীয় উষ্ণতা",
        "param_chlorophyll": "ক্ল'ৰ'ফিল",
        "param_distance": "দূৰত্ব",
        "param_bearing": "দিশ",
        "param_restricted": "নিষিদ্ধ স্থিতি",
        "footer_disclaimer": "যাত্ৰা কৰাৰ পূৰ্বে সাম্প্ৰতিক সতৰ্কবাৰ্তা নিশ্চিত কৰক।"
    }
}


def clean_markdown_to_plain(text: str) -> str:
    """Cleans markdown formatting for clear PDF paragraph rendering."""
    if not text:
        return ""
    text = re.sub(r"```[\s\S]*?```", "", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"^#{1,6}\s+(.+)$", r"<b>\1</b><br/>", text, flags=re.MULTILINE)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"\*([^*]+)\*", r"<i>\1</i>", text)
    text = text.replace("\n\n", "<br/><br/>").replace("\n", " ")
    return text.strip()


def build_vector_minimap_drawing(
    width: float,
    height: float,
    vessel_lat: float,
    vessel_lon: float,
    pfz_lat: Optional[float],
    pfz_lon: Optional[float],
    labels: Dict[str, str]
) -> Drawing:
    """Renders a custom vector mini-map drawing directly on ReportLab canvas.
    Avoids raster basemap limitations and renders genuinely localized labels.
    """
    d = Drawing(width, height)

    # 1. Background Water Body (Light Azure Blue)
    d.add(Rect(0, 0, width, height, fillColor=colors.HexColor("#e0f2fe"), strokeColor=colors.HexColor("#0284c7"), strokeWidth=1.5, rx=6, ry=6))

    # 2. Approximate Coastline / Land Polygon (Slate Sand #fef3c7)
    coast_pts = [0, 0, 85, 0, 110, 45, 95, 90, 130, 135, 105, height, 0, height]
    d.add(Polygon(coast_pts, fillColor=colors.HexColor("#fef3c7"), strokeColor=colors.HexColor("#d97706"), strokeWidth=1))

    # Land Label
    d.add(String(18, height - 20, "COASTAL INLAND", fontName=FONT_BOLD, fontSize=8, fillColor=colors.HexColor("#b45309")))
    d.add(String(18, height - 32, "(TERRA FIRMA)", fontName=FONT_NAME, fontSize=6.5, fillColor=colors.HexColor("#d97706")))

    # 3. Restricted Naval Sanctuary Polygon (Red #fee2e2 with #dc2626 dashed border)
    rx1, ry1, rx2, ry2 = width - 130, height - 75, width - 20, height - 15
    d.add(Rect(rx1, ry1, rx2 - rx1, ry2 - ry1, fillColor=colors.HexColor("#fee2e2"), strokeColor=colors.HexColor("#dc2626"), strokeWidth=1.5, strokeDashArray=[4, 3], rx=4, ry=4))
    d.add(String(rx1 + 8, ry2 - 16, f"⛔ {labels.get('restricted_label', 'Restricted Zone')}", fontName=FONT_BOLD, fontSize=7, fillColor=colors.HexColor("#b91c1c")))
    d.add(String(rx1 + 8, ry2 - 28, "Naval Defense Exclusion", fontName=FONT_NAME, fontSize=6.5, fillColor=colors.HexColor("#991b1b")))

    # 4. User / Vessel Origin Marker (Blue Circle + Pin at ~ (130, 80))
    vx, vy = 135, 75
    d.add(Circle(vx, vy, 12, fillColor=colors.HexColor("#2563eb"), strokeColor=colors.white, strokeWidth=2))
    d.add(Circle(vx, vy, 3, fillColor=colors.white, strokeColor=colors.white, strokeWidth=1))
    d.add(String(vx - 25, vy - 18, f"⚓ {labels.get('vessel_origin', 'Vessel Origin')}", fontName=FONT_BOLD, fontSize=7.5, fillColor=colors.HexColor("#1e40af")))
    d.add(String(vx - 25, vy - 28, f"{vessel_lat:.2f}°N, {vessel_lon:.2f}°E", fontName=FONT_NAME, fontSize=6.5, fillColor=colors.HexColor("#475569")))

    # 5. PFZ Target Star Pin (Green Star / Circle at ~ (320, 105))
    px, py = 330, 105
    d.add(Line(vx, vy, px, py, strokeColor=colors.HexColor("#0284c7"), strokeWidth=2, strokeDashArray=[5, 4]))
    d.add(Circle(px, py, 13, fillColor=colors.HexColor("#059669"), strokeColor=colors.white, strokeWidth=2))
    d.add(Circle(px, py, 4, fillColor=colors.HexColor("#fef08a"), strokeColor=colors.white, strokeWidth=1))
    d.add(String(px - 35, py + 18, f"★ {labels.get('pfz_label', 'PFZ Zone')}", fontName=FONT_BOLD, fontSize=7.5, fillColor=colors.HexColor("#065f46")))
    if pfz_lat and pfz_lon:
        d.add(String(px - 35, py + 8, f"{pfz_lat:.2f}°N, {pfz_lon:.2f}°E", fontName=FONT_NAME, fontSize=6.5, fillColor=colors.HexColor("#475569")))

    # Midpoint course label
    mx, my = (vx + px) / 2, (vy + py) / 2
    d.add(Rect(mx - 36, my - 8, 72, 16, fillColor=colors.HexColor("#ffffff"), strokeColor=colors.HexColor("#0284c7"), strokeWidth=1, rx=3, ry=3))
    d.add(String(mx - 32, my - 4, f"🧭 {labels.get('nav_course', 'Course')}", fontName=FONT_BOLD, fontSize=6.5, fillColor=colors.HexColor("#0284c7")))

    # Mini Compass Rose on top left
    cx, cy = width - 40, height - 35
    d.add(Circle(cx, cy, 12, fillColor=colors.white, strokeColor=colors.HexColor("#94a3b8"), strokeWidth=1))
    d.add(String(cx - 3, cy + 2, "N", fontName=FONT_BOLD, fontSize=7, fillColor=colors.HexColor("#0f172a")))
    d.add(String(cx - 3, cy - 8, "S", fontName=FONT_NAME, fontSize=6, fillColor=colors.HexColor("#64748b")))

    return d


def generate_marine_advisory_pdf(
    query_id: str,
    verdict: str,
    safety_summary: str,
    report_text: str,
    location_name: str,
    coordinates: Dict[str, float],
    weather_metrics: Dict[str, Any],
    pfz_recommendation: Optional[Dict[str, Any]],
    geospatial_info: Dict[str, Any],
    language: str = "en",
    timestamp: Optional[str] = None
) -> bytes:
    """Generates a high-quality, localized marine safety advisory PDF document."""
    lang_code = language.lower() if language in PDF_I18N else "en"
    i18n = PDF_I18N.get(lang_code, PDF_I18N["en"])

    pdf_buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        pdf_buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    normal_style = styles["Normal"]
    normal_style.fontName = FONT_NAME
    normal_style.fontSize = 9.5
    normal_style.leading = 13.5
    normal_style.textColor = colors.HexColor("#1e293b")

    heading_style = ParagraphStyle(
        "SectionHeading",
        parent=normal_style,
        fontName=FONT_BOLD,
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#0284c7"),
        spaceBefore=10,
        spaceAfter=4
    )

    story = []

    # 1. Header Banner
    header_data = [
        [
            Paragraph(f"<b><font size=16 color='#0284c7'>ORCA</font></b> • <font size=10 color='#38bdf8'>ISRO SIH26176</font><br/><font size=8 color='#64748b'>{i18n['subtitle']}</font>", normal_style),
            Paragraph(f"<font size=8 color='#64748b'>Ref: <b>{query_id}</b><br/>Issued: {timestamp or datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}<br/>Lang: <b>{lang_code.upper()}</b></font>", normal_style)
        ]
    ]
    header_table = Table(header_data, colWidths=[360, 160])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, -1), 1.5, colors.HexColor("#0284c7")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8)
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10))

    # 2. Localized Title
    story.append(Paragraph(f"<b><font size=13 color='#0f172a'>{i18n['title']}</font></b>", heading_style))
    story.append(Spacer(1, 6))

    # 3. Verdict Badge Table
    norm_verdict = (verdict or "UNKNOWN").upper().strip()
    verdict_colors_map = {
        "SAFE": ("#16a34a", "#dcfce7"),
        "CAUTION": ("#d97706", "#fef3c7"),
        "UNSAFE": ("#dc2626", "#fee2e2")
    }
    v_text_color, v_bg_color = verdict_colors_map.get(norm_verdict, ("#475569", "#f1f5f9"))

    verdict_box = [
        [
            Paragraph(f"<font size=8 color='{v_text_color}'><b>{i18n['verdict_label']}</b></font>", normal_style),
            Paragraph(f"<b><font size=14 color='{v_text_color}'>[{norm_verdict}]</font></b>", normal_style)
        ]
    ]
    v_table = Table(verdict_box, colWidths=[130, 390])
    v_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(v_bg_color)),
        ("BOX", (0, 0), (-1, -1), 1.5, colors.HexColor(v_text_color)),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, 0), "LEFT"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 10)
    ]))
    story.append(v_table)
    story.append(Spacer(1, 10))

    # 4. Safety Summary Box
    if safety_summary:
        clean_sum = clean_markdown_to_plain(safety_summary)
        summary_box = [
            [Paragraph(f"<b>{i18n['summary_heading']}:</b><br/>{clean_sum}", normal_style)]
        ]
        s_table = Table(summary_box, colWidths=[520])
        s_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("LINELEFT", (0, 0), (0, 0), 3.5, colors.HexColor(v_text_color)),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING", (0, 0), (-1, -1), 10)
        ]))
        story.append(s_table)
        story.append(Spacer(1, 10))

    # 5. Vector Mini-Map Canvas
    story.append(Paragraph(f"<b>{i18n['map_heading']}</b>", heading_style))
    v_lat = coordinates.get("lat", 12.87) if coordinates else 12.87
    v_lon = coordinates.get("lon", 74.84) if coordinates else 74.84
    p_lat = pfz_recommendation.get("lat") if pfz_recommendation else None
    p_lon = pfz_recommendation.get("lon") if pfz_recommendation else None

    minimap_drawing = build_vector_minimap_drawing(
        width=520,
        height=150,
        vessel_lat=v_lat,
        vessel_lon=v_lon,
        pfz_lat=p_lat,
        pfz_lon=p_lon,
        labels=i18n
    )
    story.append(minimap_drawing)
    story.append(Spacer(1, 10))

    # 6. Oceanographic & Atmospheric Telemetry Table
    story.append(Paragraph(f"<b>{i18n['telemetry_heading']}</b>", heading_style))
    wind = weather_metrics.get("wind_speed_kmh", "N/A")
    gust = weather_metrics.get("wind_gust_kmh", "N/A")
    wave = weather_metrics.get("wave_height_m", "N/A")
    pfz_id = pfz_recommendation.get("id", "None") if pfz_recommendation else "N/A"
    pfz_dist = pfz_recommendation.get("distance_km") or pfz_recommendation.get("distance_user_km", "N/A") if pfz_recommendation else "N/A"
    pfz_bearing = pfz_recommendation.get("bearing_deg") or pfz_recommendation.get("bearing_user_deg", "N/A") if pfz_recommendation else "N/A"
    sst = pfz_recommendation.get("sst_c", "N/A") if pfz_recommendation else "N/A"
    chlorophyll = pfz_recommendation.get("chlorophyll_mg_m3", "N/A") if pfz_recommendation else "N/A"
    geo_status = geospatial_info.get("status_description", "Clear of restricted perimeters")

    telemetry_rows = [
        [i18n.get("param_location", "Evaluated Location"), f"{location_name} ({v_lat:.2f}°N, {v_lon:.2f}°E)"],
        [i18n.get("param_wind", "Wind Speed & Gusts"), f"{wind} km/h (Gusts: {gust} km/h)"],
        [i18n.get("param_wave", "Significant Wave Height"), f"{wave} meters"],
        [i18n.get("pfz_label", "Recommended PFZ"), f"{pfz_id} ({pfz_dist} km @ {pfz_bearing}°)" if pfz_id != "None" else "No safe PFZ"],
        [i18n.get("param_sst", "Sea Surface Temp (SST)"), f"{sst} °C (Chlorophyll: {chlorophyll} mg/m³)" if sst != "N/A" else "N/A"],
        [i18n.get("param_restricted", "Restricted Zone Status"), geo_status]
    ]

    t_table = Table(
        [[Paragraph(f"<b>{r[0]}</b>", normal_style), Paragraph(str(r[1]), normal_style)] for r in telemetry_rows],
        colWidths=[180, 340]
    )
    t_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f1f5f9")),
        ("BACKGROUND", (1, 0), (1, -1), colors.HexColor("#ffffff")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 8)
    ]))
    story.append(t_table)
    story.append(Spacer(1, 10))

    # 7. Localized Advisory Report Text
    if report_text:
        story.append(Paragraph(f"<b>{i18n['report_heading']}</b>", heading_style))
        clean_report = clean_markdown_to_plain(report_text)
        report_p = Paragraph(clean_report, normal_style)
        story.append(report_p)
        story.append(Spacer(1, 12))

    # 8. Footer Disclaimer
    story.append(Spacer(1, 10))
    disclaimer_p = Paragraph(
        f"<font size=7 color='#64748b'><b>ORCA Marine Decision Platform</b> • {i18n['footer_disclaimer']}</font>",
        normal_style
    )
    story.append(disclaimer_p)

    doc.build(story)
    pdf_buffer.seek(0)
    return pdf_buffer.getvalue()
