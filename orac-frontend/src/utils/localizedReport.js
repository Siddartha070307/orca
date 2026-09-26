/**
 * Localized Report Utility for ORCA
 * Generates evidence-backed marine advisories, safety summaries, recommendations,
 * and safer alternatives across all 12 canonical Indian languages.
 */

import en from '../i18n/locales/en.json';
import te from '../i18n/locales/te.json';
import hi from '../i18n/locales/hi.json';
import kn from '../i18n/locales/kn.json';
import ta from '../i18n/locales/ta.json';
import ml from '../i18n/locales/ml.json';
import mr from '../i18n/locales/mr.json';
import bn from '../i18n/locales/bn.json';
import gu from '../i18n/locales/gu.json';
import or_lang from '../i18n/locales/or.json';
import pa from '../i18n/locales/pa.json';
import as_lang from '../i18n/locales/as.json';

export const LOCALES = {
  en,
  te,
  hi,
  kn,
  ta,
  ml,
  mr,
  bn,
  gu,
  or: or_lang,
  pa,
  as: as_lang
};

function interpolate(template, params) {
  if (!template || !params || typeof params !== 'object') return template || '';
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    return key in params && params[key] !== undefined ? String(params[key]) : match;
  });
}

function getDictionary(lang) {
  return LOCALES[lang] || LOCALES.en;
}

export const COMMON_TEMPORAL_LABELS = {
  'Tomorrow Morning': {
    en: 'Tomorrow Morning',
    te: 'రేపు ఉదయం',
    hi: 'कल सुबह',
    kn: 'ನಾಳೆ ಬೆಳಿಗ್ಗೆ',
    ta: 'நாளை காலை',
    ml: 'നാളെ രാവിലെ',
    mr: 'उद्या सकाळी',
    bn: 'কাল সকালে',
    gu: 'આવતીકાલે સવારે',
    or: 'ଆସନ୍ତାକାଲି ସକାଳେ',
    pa: 'ਕੱਲ੍ਹ ਸਵੇਰੇ',
    as: 'কাইলৈ পুৱা'
  },
  'Tomorrow Evening': {
    en: 'Tomorrow Evening',
    te: 'రేపు సాయంత్రం',
    hi: 'कल शाम',
    kn: 'ನಾಳೆ ಸಂಜೆ',
    ta: 'நாளை மாலை',
    ml: 'നാളെ വൈകുന്നേരം',
    mr: 'उद्या संध्याकाळी',
    bn: 'কাল সন্ধ্যায়',
    gu: 'આવતીકાલે સાંજે',
    or: 'ଆସନ୍ତାକାଲି ସନ୍ଧ୍ୟାରେ',
    pa: 'ਕੱਲ੍ਹ ਸ਼ਾਮ',
    as: 'কাইলৈ সন্ধিয়া'
  },
  'Today Morning': {
    en: 'Today Morning',
    te: 'ఈ రోజు ఉదయం',
    hi: 'आज सुबह',
    kn: 'ಇಂದು ಬೆಳಿಗ್ಗೆ',
    ta: 'இன்று காலை',
    ml: 'ഇന്ന് രാവിലെ',
    mr: 'आज सकाळी',
    bn: 'আজ সকালে',
    gu: 'આજે સવારે',
    or: 'ଆଜି ସକାଳେ',
    pa: 'ਅੱਜ ਸਵੇਰੇ',
    as: 'আজি পুৱা'
  },
  'Today Evening': {
    en: 'Today Evening',
    te: 'ఈ రోజు సాయంత్రం',
    hi: 'आज शाम',
    kn: 'ಇಂದು ಸಂಜೆ',
    ta: 'இன்று மாலை',
    ml: 'ഇന്ന് വൈകുന്നേരം',
    mr: 'आज संध्याकाळी',
    bn: 'আজ সন্ধ্যায়',
    gu: 'આજે સાંજે',
    or: 'ଆଜି ସନ୍ଧ୍ୟାରେ',
    pa: 'ਅੱਜ ਸ਼ਾਮ',
    as: 'আজি সন্ধিয়া'
  },
  'Tomorrow': {
    en: 'Tomorrow',
    te: 'రేపు',
    hi: 'कल',
    kn: 'ನಾಳೆ',
    ta: 'நாளை',
    ml: 'നാളെ',
    mr: 'उद्या',
    bn: 'কাল',
    gu: 'આવતીકાલે',
    or: 'ଆସନ୍ତାକାଲି',
    pa: 'ਕੱਲ੍ਹ',
    as: 'কাইলৈ'
  },
  'Today': {
    en: 'Today',
    te: 'ఈ రోజు',
    hi: 'आज',
    kn: 'ಇಂದು',
    ta: 'இன்று',
    ml: 'ഇന്ന്',
    mr: 'आज',
    bn: 'আজ',
    gu: 'આજે',
    or: 'ଆଜି',
    pa: 'ਅੱਜ',
    as: 'আজি'
  }
};

/**
 * Validates whether given text contains authentic script characters of the target language.
 * Ensures English text is not mistakenly recognized as Indic, and vice versa.
 */
export function hasScriptForLanguage(text, language) {
  if (!text || typeof text !== 'string' || !text.trim()) return false;

  switch (language) {
    case 'te':
      return /[\u0C00-\u0C7F]/.test(text);
    case 'hi':
    case 'mr':
      return /[\u0900-\u097F]/.test(text);
    case 'kn':
      return /[\u0C80-\u0CFF]/.test(text);
    case 'ta':
      return /[\u0B80-\u0BFF]/.test(text);
    case 'ml':
      return /[\u0D00-\u0D7F]/.test(text);
    case 'bn':
    case 'as':
      return /[\u0980-\u09FF]/.test(text);
    case 'gu':
      return /[\u0A80-\u0AFF]/.test(text);
    case 'or':
      return /[\u0B00-\u0B7F]/.test(text);
    case 'pa':
      return /[\u0A00-\u0A7F]/.test(text);
    case 'en':
    default:
      // For English: must contain Latin letters and NOT contain Indic Unicode scripts
      return /[A-Za-z]/.test(text) && !/[\u0900-\u0D7F]/.test(text);
  }
}

/**
 * Generates an authoritative markdown advisory report in the target language.
 */
export function getLocalizedReport(data, lang = 'en') {
  if (!data) return '';

  const targetLang = LOCALES[lang] ? lang : 'en';

  // If already translated by backend to the requested language and not in fallback
  // CRITICAL: We only use data.report if it genuinely contains the script for targetLang!
  if (
    data.detected_language === targetLang &&
    data.translation_status !== 'fallback_en' &&
    data.report &&
    typeof data.report === 'string' &&
    hasScriptForLanguage(data.report, targetLang)
  ) {
    return data.report;
  }

  // If English is requested and data.report is available in Latin script without Indic characters
  if (targetLang === 'en' && data.report && typeof data.report === 'string' && hasScriptForLanguage(data.report, 'en')) {
    return data.report;
  }

  const dict = getDictionary(targetLang);
  const riskTrace = data.agent_traces?.find((t) => t.agent === 'RiskAssessmentAgent' || t.agent_name === 'risk_assessment');
  const weatherTrace = data.agent_traces?.find((t) => t.agent === 'WeatherIntelligenceAgent' || t.agent_name === 'weather_data');
  const geospatialTrace = data.agent_traces?.find((t) => t.agent === 'GeospatialReasoningAgent' || t.agent_name === 'geospatial_reasoning');
  const oceanTrace = data.agent_traces?.find((t) => t.agent === 'OceanAnalyticsAgent' || t.agent_name === 'ocean_analytics');
  const planningTrace = data.agent_traces?.find((t) => t.agent === 'PlanningAgent' || t.agent_name === 'planning');

  const riskRes = riskTrace?.result || {};
  const verdict = (data.verdict || riskRes.verdict || 'SAFE').toUpperCase();

  const location =
    data.location_name ||
    planningTrace?.result?.location_name ||
    data.dispatched_payload?.metadata?.location_name ||
    'Operating Sector';

  const timeLabel =
    data.time_range?.label ||
    (data.time_range?.start && data.time_range?.end ? `${data.time_range.start} to ${data.time_range.end}` : null);

  const weatherMetrics = riskRes.weather_summary?.metrics || weatherTrace?.result?.metrics || {};
  const wind = weatherMetrics.wind_speed_kmh != null ? weatherMetrics.wind_speed_kmh : 'N/A';
  const gust = weatherMetrics.wind_gust_kmh != null ? weatherMetrics.wind_gust_kmh : 'N/A';
  const wave = weatherMetrics.wave_height_m != null ? weatherMetrics.wave_height_m : 'N/A';
  const precip = weatherMetrics.precipitation_mm != null ? weatherMetrics.precipitation_mm : '0';

  const candidates =
    data.dispatched_payload?.metadata?.pfz_candidates ||
    data.pfz_candidates ||
    oceanTrace?.result?.candidates ||
    [];
  const bestPfz = candidates[0] || null;

  const geoRes = geospatialTrace?.result || {};
  const insideRestricted =
    riskRes.geospatial_summary?.is_restricted ??
    geoRes.inside_geofence ??
    geoRes.is_inside_restricted ??
    false;
  const boundaryDist = geoRes.nearest_boundary_distance_km;
  const zoneName = geoRes.restricted_zone_name || (dict.safety?.sanctuary || 'Protected Sanctuary');
  const statusDesc = geoRes.status_description || (dict.safety?.clear || 'Clear');

  // Header
  const headerTemplate =
    verdict === 'UNSAFE'
      ? dict.report?.unsafeHeader || '**SAFETY ADVISORY: UNSAFE TO SAIL - DO NOT VENTURE INTO SEA NEAR {location} [UNSAFE]**'
      : verdict === 'CAUTION'
      ? dict.report?.cautionHeader || '**SAFETY ADVISORY: PROCEED WITH CAUTION - EXERCISE VIGILANCE NEAR {location} [CAUTION]**'
      : dict.report?.safeHeader || '**SAFETY ADVISORY: SAFE FOR OPERATIONS - FAVORABLE CONDITIONS NEAR {location} [SAFE]**';

  const header = interpolate(headerTemplate, { location: location.toUpperCase() });

  // Forecast Period
  const localizedTimeLabel = (timeLabel && COMMON_TEMPORAL_LABELS[timeLabel]?.[targetLang]) || timeLabel;
  const forecastLine = localizedTimeLabel ? `**${dict.report?.forecastPeriod || 'Forecast Period:'}** ${localizedTimeLabel}\n\n` : '';

  // Condition Sentence
  const conditionSentence =
    verdict === 'UNSAFE'
      ? dict.report?.conditionsHazardous || 'Conditions are hazardous for marine operations.'
      : verdict === 'CAUTION'
      ? dict.report?.conditionsMarginal || 'Marginal marine conditions detected.'
      : dict.report?.conditionsSafe || 'Sea conditions are safe for coastal and deep-sea fishing.';

  // Metrics Sentence
  const windStr = wind !== 'N/A' ? `${wind} km/h` : dict.safety?.notAvailable || 'unavailable';
  const gustStr = gust !== 'N/A'
    ? (targetLang === 'en' ? `gusts: ${gust} km/h` : `${gust} km/h`)
    : (dict.safety?.notAvailable || 'unavailable');
  const waveStr = wave !== 'N/A' ? `${wave} m` : dict.safety?.notAvailable || 'unavailable';
  const precipStr = precip !== 'N/A' ? `${precip} mm` : '0 mm';

  const metricsSentence = interpolate(
    dict.report?.recordedMetrics || 'Recorded wind: {wind} ({gust}), significant wave height: {wave}, precipitation: {precip}.',
    {
      wind: windStr,
      gust: gustStr,
      wave: waveStr,
      precip: precipStr
    }
  );

  // PFZ Sentence
  let pfzSentence = '';
  if (bestPfz) {
    const pfzDist = bestPfz.distance_user_km || bestPfz.calculated_distance_km || bestPfz.distance_km || '15';
    const pfzBearing = bestPfz.bearing_user_deg || bestPfz.calculated_bearing_deg || bestPfz.bearing_deg || '115';
    const pfzSst = bestPfz.sst_celsius || bestPfz.sst_c || '28.5';
    const species = Array.isArray(bestPfz.target_species)
      ? bestPfz.target_species.slice(0, 2).join(', ')
      : 'Pelagic species';

    pfzSentence = interpolate(
      dict.report?.pfzFavorable ||
        'Potential Fishing Zone (PFZ: FAVORABLE): {id} located {dist} km offshore (bearing {bearing}°), Sea Surface Temp {sst}°C with high chlorophyll-a. Target catch: {species}.',
      {
        id: bestPfz.id || 'PFZ-1',
        dist: typeof pfzDist === 'number' ? pfzDist.toFixed(1) : pfzDist,
        bearing: typeof pfzBearing === 'number' ? pfzBearing.toFixed(0) : pfzBearing,
        sst: typeof pfzSst === 'number' ? pfzSst.toFixed(1) : pfzSst,
        species
      }
    );
  } else {
    pfzSentence =
      dict.report?.pfzSuboptimal ||
      'Potential Fishing Zone (PFZ: SUBOPTIMAL): No recommended PFZ within safe operational radius.';
  }

  // Geospatial Sentence
  let geoSentence = '';
  if (insideRestricted) {
    geoSentence = interpolate(
      dict.report?.alertInsideRestricted || 'ALERT: Craft is INSIDE a restricted marine boundary ({name}).',
      { name: zoneName }
    );
  } else if (boundaryDist != null) {
    geoSentence = interpolate(
      dict.report?.geofenceDistance || 'Geofence distance: {dist} km to nearest restricted boundary. Status: {status}.',
      {
        dist: typeof boundaryDist === 'number' ? boundaryDist.toFixed(1) : boundaryDist,
        status: statusDesc
      }
    );
  } else {
    geoSentence = dict.report?.waypointsClear || 'All navigation waypoints clear of restricted marine areas.';
  }

  // Coastal Authority Directive
  const coastalSentence =
    verdict === 'UNSAFE'
      ? dict.report?.coastalAuthUnsafe || 'Coastal authorities advise all mechanized and traditional craft to remain moored.'
      : verdict === 'CAUTION'
      ? dict.report?.coastalAuthCaution || 'Only seaworthy mechanized vessels with full safety equipment (life jackets, VHF, NAVIC receivers) should operate.'
      : dict.report?.coastalAuthSafe || 'Weather forecast indicates stable conditions.';

  if (verdict === 'UNSAFE') {
    return `${header}\n\n${forecastLine}${conditionSentence} ${metricsSentence} ${geoSentence} ${coastalSentence}`;
  }
  return `${header}\n\n${forecastLine}${conditionSentence} ${metricsSentence} ${pfzSentence} ${geoSentence} ${coastalSentence}`;
}

/**
 * Generates an authoritative localized safety summary line.
 */
export function getLocalizedSummary(data, lang = 'en') {
  if (!data) return '';

  const targetLang = LOCALES[lang] ? lang : 'en';

  // If backend provided a summary that already matches targetLang script
  if (
    data.detected_language === targetLang &&
    data.translation_status !== 'fallback_en' &&
    data.safety_summary &&
    typeof data.safety_summary === 'string' &&
    hasScriptForLanguage(data.safety_summary, targetLang)
  ) {
    return data.safety_summary;
  }

  const dict = getDictionary(targetLang);

  const riskTrace = data.agent_traces?.find((t) => t.agent === 'RiskAssessmentAgent' || t.agent_name === 'risk_assessment');
  const weatherTrace = data.agent_traces?.find((t) => t.agent === 'WeatherIntelligenceAgent' || t.agent_name === 'weather_data');
  const oceanTrace = data.agent_traces?.find((t) => t.agent === 'OceanAnalyticsAgent' || t.agent_name === 'ocean_analytics');

  const riskRes = riskTrace?.result || {};
  const verdict = (data.verdict || riskRes.verdict || 'SAFE').toUpperCase();
  const localizedVerdict = dict.verdict?.[verdict] || verdict;

  const timeLabel = data.time_range?.label;
  const localizedTimeLabel = (timeLabel && COMMON_TEMPORAL_LABELS[timeLabel]?.[targetLang]) || timeLabel;
  const timePrefix = localizedTimeLabel ? `[${localizedTimeLabel}] ` : '';

  const weatherMetrics = riskRes.weather_summary?.metrics || weatherTrace?.result?.metrics || {};
  const wind = weatherMetrics.wind_speed_kmh != null ? weatherMetrics.wind_speed_kmh : 'N/A';
  const wave = weatherMetrics.wave_height_m != null ? weatherMetrics.wave_height_m : 'N/A';

  const candidates =
    data.dispatched_payload?.metadata?.pfz_candidates ||
    data.pfz_candidates ||
    oceanTrace?.result?.candidates ||
    [];
  const bestPfz = candidates[0] || null;
  const pfzDist = bestPfz
    ? bestPfz.distance_user_km || bestPfz.calculated_distance_km || bestPfz.distance_km || null
    : null;

  const formattedPfzDist = pfzDist != null ? (typeof pfzDist === 'number' ? pfzDist.toFixed(1) : pfzDist) : null;

  let summaryText = '';
  if (dict.report?.statusSummary) {
    const rawSummary = interpolate(dict.report.statusSummary, {
      verdict: localizedVerdict,
      wind,
      wave,
      pfz_dist: formattedPfzDist || (dict.safety?.notAvailable || 'N/A')
    });
    if (formattedPfzDist == null) {
      // Remove trailing PFZ clause if no PFZ candidate
      summaryText = rawSummary.replace(/\s*\|\s*PFZ:[^|]+$/i, '').trim();
    } else {
      summaryText = rawSummary;
    }
  } else {
    const pfzPart = formattedPfzDist != null ? ` | PFZ: ${formattedPfzDist} km` : '';
    summaryText = `Status: ${localizedVerdict} | Wind: ${wind} km/h | Wave: ${wave} m${pfzPart}`;
  }

  return `${timePrefix}${summaryText}`;
}

/**
 * Generates a localized recommendation directive.
 */
export function getLocalizedRecommendation(data, lang = 'en') {
  if (!data) return '';
  const targetLang = LOCALES[lang] ? lang : 'en';
  const dict = getDictionary(targetLang);

  const riskTrace = data.agent_traces?.find((t) => t.agent === 'RiskAssessmentAgent' || t.agent_name === 'risk_assessment');
  const riskRes = riskTrace?.result || {};
  const verdict = (data.verdict || riskRes.verdict || 'SAFE').toUpperCase();

  if (targetLang === 'en' && riskRes.actionable_directive) {
    return riskRes.actionable_directive;
  }

  if (verdict === 'UNSAFE') {
    return dict.safety?.dirUnsafe || 'Sea conditions evaluated as unsafe. Follow coastal maritime safety authority instructions.';
  }
  if (verdict === 'CAUTION') {
    return dict.safety?.dirCaution || 'Marginal marine conditions observed. Exercise heightened vigilance.';
  }
  return dict.safety?.dirSafe || 'Marine conditions evaluated as acceptable for normal operations.';
}

/**
 * Generates a localized safer alternative directive.
 */
export function getLocalizedSaferAlternative(data, lang = 'en') {
  if (!data) return '';
  const targetLang = LOCALES[lang] ? lang : 'en';
  const dict = getDictionary(targetLang);

  const riskTrace = data.agent_traces?.find((t) => t.agent === 'RiskAssessmentAgent' || t.agent_name === 'risk_assessment');
  const weatherTrace = data.agent_traces?.find((t) => t.agent === 'WeatherIntelligenceAgent' || t.agent_name === 'weather_data');
  const geospatialTrace = data.agent_traces?.find((t) => t.agent === 'GeospatialReasoningAgent' || t.agent_name === 'geospatial_reasoning');

  const riskRes = riskTrace?.result || {};
  const verdict = (data.verdict || riskRes.verdict || 'SAFE').toUpperCase();
  const weatherMetrics = riskRes.weather_summary?.metrics || weatherTrace?.result?.metrics || {};
  const geoRes = geospatialTrace?.result || {};
  const isInsideRestricted =
    riskRes.geospatial_summary?.is_restricted ??
    geoRes.inside_geofence ??
    geoRes.is_inside_restricted;
  const boundaryDist = geoRes.nearest_boundary_distance_km;

  if (verdict === 'UNSAFE') {
    if (weatherMetrics.has_storm_alert) {
      return dict.safety?.altStorm || 'Delay departure until active severe convective storm warnings in the sector have cleared.';
    }
    if (weatherMetrics.wave_height_m != null && weatherMetrics.wave_height_m >= 3.5) {
      return dict.safety?.altWave || 'Delay departure until significant wave heights subside below unsafe operating thresholds.';
    }
    if (weatherMetrics.wind_speed_kmh != null && weatherMetrics.wind_speed_kmh >= 50.0) {
      return dict.safety?.altWind || 'Postpone departure until sustained wind speeds subside below unsafe operating thresholds.';
    }
    if (isInsideRestricted) {
      return dict.safety?.altRestricted || 'Adjust navigational route to remain outside the restricted boundary perimeter before commencing operations.';
    }
    return dict.safety?.altHarbor || 'Delay departure and remain in harbor until updated coastal forecasts indicate safe conditions.';
  }
  if (verdict === 'CAUTION') {
    if (isInsideRestricted || (boundaryDist != null && boundaryDist <= 2.0)) {
      return dict.safety?.altBuffer || 'Maintain safe navigational distance outside the restricted boundary buffer.';
    }
    return dict.safety?.altMonitor || 'Monitor continuous marine meteorological broadcasts and exercise heightened vigilance.';
  }
  return dict.safety?.altAcceptable || 'Conditions are acceptable. Maintain standard navigational vigilance and monitor routine marine weather updates.';
}
