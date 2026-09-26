"""Temporal Reasoning and Window Normalization Engine for ORCA.

Provides deterministic temporal extraction, normalization to explicit IST time ranges,
and time-windowed forecast filtering for marine safety evaluation.
"""
from datetime import datetime, date, time, timedelta, timezone
import re
from typing import Dict, Any, Optional, List, Tuple

# Indian Standard Time (IST) offset is UTC+05:30
IST = timezone(timedelta(hours=5, minutes=30), name="IST")


def parse_iso_datetime(dt_str: str, default_tz: timezone = IST) -> datetime:
    """Parses an ISO 8601 datetime string into a timezone-aware datetime object.
    
    If the string lacks timezone information, applies default_tz (IST).
    """
    cleaned = dt_str.strip()
    if cleaned.endswith("Z"):
        cleaned = cleaned[:-1] + "+00:00"
    
    dt = datetime.fromisoformat(cleaned)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=default_tz)
    return dt.astimezone(default_tz)


MONTHS = {
    "january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3,
    "april": 4, "apr": 4, "may": 5, "june": 6, "jun": 6, "july": 7, "jul": 7,
    "august": 8, "aug": 8, "september": 9, "sept": 9, "sep": 9, "october": 10, "oct": 10,
    "november": 11, "nov": 11, "december": 12, "dec": 12
}
_MONTH_PATTERN = "|".join(sorted(MONTHS.keys(), key=len, reverse=True))


def extract_explicit_date(text: str, reference_date: Optional[date] = None) -> Optional[date]:
    """Extracts a calendar date from text in ISO or natural month/day format.
    
    If year is omitted, derives the year dynamically from reference_date (or current IST date),
    accurately handling year boundaries.
    """
    ref_d = reference_date or datetime.now(IST).date()
    default_year = ref_d.year
    q_low = text.lower()

    # 1. ISO format: YYYY-MM-DD
    m = re.search(r'\b(\d{4})-(\d{1,2})-(\d{1,2})\b', q_low)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            pass

    def _resolve_year(explicit_yr_str: Optional[str], month: int, day: int) -> Optional[date]:
        if explicit_yr_str:
            try:
                return date(int(explicit_yr_str), month, day)
            except ValueError:
                return None
        # Omitted year: derive from reference_date
        yr = default_year
        # Handle year boundary: if reference date is in late year (Nov/Dec) and target is in early year (Jan/Feb)
        if ref_d.month >= 11 and month <= 2:
            yr = default_year + 1
        try:
            return date(yr, month, day)
        except ValueError:
            return None

    # 2. Month Day, Year (e.g. "September 11, 2026", "Sept 11 2026", "September 11th", "September 11")
    m = re.search(rf'\b({_MONTH_PATTERN})\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:,?\s+(\d{{4}}))?\b', q_low)
    if m:
        mon = MONTHS[m.group(1)]
        day = int(m.group(2))
        res = _resolve_year(m.group(3), mon, day)
        if res:
            return res

    # 3. Day Month Year (e.g. "11 September 2026", "11th September 2026", "11th of September", "11 September")
    m = re.search(rf'\b(\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?({_MONTH_PATTERN})\.?(?:,?\s+(\d{{4}}))?\b', q_low)
    if m:
        day = int(m.group(1))
        mon = MONTHS[m.group(2)]
        res = _resolve_year(m.group(3), mon, day)
        if res:
            return res

    return None


def extract_time_of_day_period(text: str) -> Optional[str]:
    """Extracts canonical time-of-day period: morning, afternoon, evening, night."""
    q_low = text.lower()
    if re.search(r'\b(morning|am)\b', q_low):
        return "morning"
    if re.search(r'\b(afternoon|pm)\b', q_low):
        return "afternoon"
    if re.search(r'\b(evening)\b', q_low):
        return "evening"
    if re.search(r'\b(night|tonight)\b', q_low):
        return "night"
    return None


def parse_temporal_expression(query: str, reference_time: Optional[datetime] = None) -> Optional[str]:
    """Extracts canonical temporal expression from user query text.
    
    Order of precedence is critical:
    1. Explicit calendar dates (with or without time-of-day qualifier) are authoritative.
    2. 'Day after tomorrow' sub-day and day expressions.
    3. 'Tomorrow' sub-day and day expressions.
    4. 'Today' sub-day and day expressions (including tonight).
    5. Rolling window expressions (next 24h/48h).
    6. Immediate / current expressions ('now').
    """
    ref = reference_time or datetime.now(IST)
    if ref.tzinfo is None:
        ref = ref.replace(tzinfo=IST)
    else:
        ref = ref.astimezone(IST)
    ref_date = ref.date()

    q = query.lower()

    # 1. Explicit calendar date (Authoritative precedence - Requirement 10K)
    d = extract_explicit_date(q, reference_date=ref_date)
    if d:
        period = extract_time_of_day_period(q)
        if period:
            return f"{d.isoformat()} {period}"
        return d.isoformat()

    # 2. Day after tomorrow expressions
    if re.search(r'\b(day\s+after\s+tomorrow|dat)\s+morning\b', q) or re.search(r'\bday\s+after\s+tomorrow\s+am\b', q):
        return "day after tomorrow morning"
    if re.search(r'\b(day\s+after\s+tomorrow|dat)\s+afternoon\b', q) or re.search(r'\bday\s+after\s+tomorrow\s+pm\b', q):
        return "day after tomorrow afternoon"
    if re.search(r'\b(day\s+after\s+tomorrow|dat)\s+evening\b', q):
        return "day after tomorrow evening"
    if re.search(r'\b(day\s+after\s+tomorrow|dat)\s+night\b', q):
        return "day after tomorrow night"
    if re.search(r'\b(day\s+after\s+tomorrow|dat)\b', q):
        return "day after tomorrow"

    # 3. Sub-day Tomorrow expressions
    if re.search(r'\b(tomorrow|tmrw)\s+morning\b', q) or re.search(r'\btomorrow\s+am\b', q):
        return "tomorrow morning"
    if re.search(r'\b(tomorrow|tmrw)\s+afternoon\b', q) or re.search(r'\btomorrow\s+pm\b', q):
        return "tomorrow afternoon"
    if re.search(r'\b(tomorrow|tmrw)\s+evening\b', q):
        return "tomorrow evening"
    if re.search(r'\b(tomorrow|tmrw)\s+night\b', q):
        return "tomorrow night"
    if re.search(r'\b(tomorrow|tmrw)\b', q) or re.search(r'\bnext\s+day\b', q):
        return "tomorrow"

    # 4. Sub-day Today expressions
    if re.search(r'\b(today|this)\s+morning\b', q) or re.search(r'\btoday\s+am\b', q):
        return "today morning"
    if re.search(r'\b(today|this)\s+afternoon\b', q) or re.search(r'\btoday\s+pm\b', q):
        return "today afternoon"
    if re.search(r'\b(today|this)\s+evening\b', q):
        return "today evening"
    if re.search(r'\b(today\s+night|tonight)\b', q):
        return "today night"
    if re.search(r'\btoday\b', q):
        return "today"

    # 5. Rolling window expressions
    if re.search(r'\b(next\s+)?24\s*(h|hr|hrs|hours)\b', q):
        return "next 24 hours"
    if re.search(r'\b(next\s+)?48\s*(h|hr|hrs|hours)\b', q) or re.search(r'\bweekend\b', q):
        return "next 48 hours"

    # 6. Immediate / current expressions
    if re.search(r'\b(now|right\s+now|currently|presently|current|at\s+present)\b', q):
        return "now"

    return None


def resolve_time_range(
    target_time: Optional[str] = None,
    reference_time: Optional[datetime] = None
) -> Dict[str, Any]:
    """Normalizes a canonical temporal target into an explicit, timezone-aware IST time window.
    
    Args:
        target_time: Expression such as 'today', 'tomorrow morning', 'September 11, 2026 in the evening', etc.
        reference_time: Base reference datetime (defaults to current time in IST).
        
    Returns:
        Dict with keys:
            start: ISO 8601 string (with +05:30 offset)
            end: ISO 8601 string (with +05:30 offset)
            label: Human-readable label for frontend/reporting
            is_current: Boolean flag indicating current conditions should be used
            target_time: Canonical normalized expression
    """
    ref = reference_time or datetime.now(IST)
    if ref.tzinfo is None:
        ref = ref.replace(tzinfo=IST)
    else:
        ref = ref.astimezone(IST)
    ref_date = ref.date()

    norm_target = (target_time or "today").strip().lower()

    # If norm_target is natural language (e.g. contains month name or phrases), convert to canonical
    parsed_canonical = parse_temporal_expression(norm_target, reference_time=ref)
    if parsed_canonical:
        norm_target = parsed_canonical

    # Case: NOW / CURRENT
    if norm_target in ["now", "current", "currently", "right now", "at present"]:
        return {
            "start": ref.isoformat(),
            "end": ref.isoformat(),
            "label": "Current Conditions",
            "is_current": True,
            "target_time": "now"
        }

    # Case: Explicit Date with optional Period (YYYY-MM-DD [morning|afternoon|evening|night])
    iso_period_match = re.match(r'^(\d{4}-\d{2}-\d{2})(?:\s+(morning|afternoon|evening|night))?$', norm_target)
    if iso_period_match:
        d = date.fromisoformat(iso_period_match.group(1))
        period = iso_period_match.group(2)
        month_name = d.strftime('%B')
        day_num = d.day
        date_str = f"{month_name} {day_num}"

        if period == "morning":
            start_dt = datetime.combine(d, time(6, 0, 0), tzinfo=IST)
            end_dt = datetime.combine(d, time(12, 0, 0), tzinfo=IST)
            return {
                "start": start_dt.isoformat(),
                "end": end_dt.isoformat(),
                "label": f"{date_str} Morning",
                "is_current": False,
                "target_time": f"{d.isoformat()} morning"
            }
        elif period == "afternoon":
            start_dt = datetime.combine(d, time(12, 0, 0), tzinfo=IST)
            end_dt = datetime.combine(d, time(17, 0, 0), tzinfo=IST)
            return {
                "start": start_dt.isoformat(),
                "end": end_dt.isoformat(),
                "label": f"{date_str} Afternoon",
                "is_current": False,
                "target_time": f"{d.isoformat()} afternoon"
            }
        elif period == "evening":
            start_dt = datetime.combine(d, time(17, 0, 0), tzinfo=IST)
            end_dt = datetime.combine(d, time(22, 0, 0), tzinfo=IST)
            return {
                "start": start_dt.isoformat(),
                "end": end_dt.isoformat(),
                "label": f"{date_str} Evening",
                "is_current": False,
                "target_time": f"{d.isoformat()} evening"
            }
        elif period == "night":
            start_dt = datetime.combine(d, time(22, 0, 0), tzinfo=IST)
            end_dt = datetime.combine(d + timedelta(days=1), time(6, 0, 0), tzinfo=IST)
            return {
                "start": start_dt.isoformat(),
                "end": end_dt.isoformat(),
                "label": f"{date_str} Night",
                "is_current": False,
                "target_time": f"{d.isoformat()} night"
            }
        else:
            # Full Day
            start_dt = datetime.combine(d, time(0, 0, 0), tzinfo=IST)
            end_dt = datetime.combine(d, time(23, 59, 59), tzinfo=IST)
            return {
                "start": start_dt.isoformat(),
                "end": end_dt.isoformat(),
                "label": f"Date: {d.isoformat()}",
                "is_current": False,
                "target_time": d.isoformat()
            }

    # Case: DAY AFTER TOMORROW (D+2)
    if norm_target in ["day after tomorrow morning", "dat morning"]:
        d2 = ref_date + timedelta(days=2)
        start_dt = datetime.combine(d2, time(6, 0, 0), tzinfo=IST)
        end_dt = datetime.combine(d2, time(12, 0, 0), tzinfo=IST)
        return {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
            "label": "Day After Tomorrow Morning",
            "is_current": False,
            "target_time": "day after tomorrow morning"
        }
    if norm_target in ["day after tomorrow afternoon", "dat afternoon"]:
        d2 = ref_date + timedelta(days=2)
        start_dt = datetime.combine(d2, time(12, 0, 0), tzinfo=IST)
        end_dt = datetime.combine(d2, time(17, 0, 0), tzinfo=IST)
        return {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
            "label": "Day After Tomorrow Afternoon",
            "is_current": False,
            "target_time": "day after tomorrow afternoon"
        }
    if norm_target in ["day after tomorrow evening", "dat evening"]:
        d2 = ref_date + timedelta(days=2)
        start_dt = datetime.combine(d2, time(17, 0, 0), tzinfo=IST)
        end_dt = datetime.combine(d2, time(22, 0, 0), tzinfo=IST)
        return {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
            "label": "Day After Tomorrow Evening",
            "is_current": False,
            "target_time": "day after tomorrow evening"
        }
    if norm_target in ["day after tomorrow night", "dat night"]:
        d2 = ref_date + timedelta(days=2)
        start_dt = datetime.combine(d2, time(22, 0, 0), tzinfo=IST)
        end_dt = datetime.combine(d2 + timedelta(days=1), time(6, 0, 0), tzinfo=IST)
        return {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
            "label": "Day After Tomorrow Night",
            "is_current": False,
            "target_time": "day after tomorrow night"
        }
    if norm_target in ["day after tomorrow", "dat"]:
        d2 = ref_date + timedelta(days=2)
        start_dt = datetime.combine(d2, time(0, 0, 0), tzinfo=IST)
        end_dt = datetime.combine(d2, time(23, 59, 59), tzinfo=IST)
        return {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
            "label": "Day After Tomorrow",
            "is_current": False,
            "target_time": "day after tomorrow"
        }

    # Case: TOMORROW MORNING (06:00 - 12:00)
    if norm_target in ["tomorrow morning", "tmrw morning"]:
        tmrw = ref_date + timedelta(days=1)
        start_dt = datetime.combine(tmrw, time(6, 0, 0), tzinfo=IST)
        end_dt = datetime.combine(tmrw, time(12, 0, 0), tzinfo=IST)
        return {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
            "label": "Tomorrow Morning",
            "is_current": False,
            "target_time": "tomorrow morning"
        }

    # Case: TOMORROW AFTERNOON (12:00 - 17:00)
    if norm_target in ["tomorrow afternoon", "tmrw afternoon"]:
        tmrw = ref_date + timedelta(days=1)
        start_dt = datetime.combine(tmrw, time(12, 0, 0), tzinfo=IST)
        end_dt = datetime.combine(tmrw, time(17, 0, 0), tzinfo=IST)
        return {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
            "label": "Tomorrow Afternoon",
            "is_current": False,
            "target_time": "tomorrow afternoon"
        }

    # Case: TOMORROW EVENING (17:00 - 22:00)
    if norm_target in ["tomorrow evening", "tmrw evening"]:
        tmrw = ref_date + timedelta(days=1)
        start_dt = datetime.combine(tmrw, time(17, 0, 0), tzinfo=IST)
        end_dt = datetime.combine(tmrw, time(22, 0, 0), tzinfo=IST)
        return {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
            "label": "Tomorrow Evening",
            "is_current": False,
            "target_time": "tomorrow evening"
        }

    # Case: TOMORROW NIGHT (22:00 - 06:00 next day)
    if norm_target in ["tomorrow night", "tmrw night"]:
        tmrw = ref_date + timedelta(days=1)
        start_dt = datetime.combine(tmrw, time(22, 0, 0), tzinfo=IST)
        end_dt = datetime.combine(tmrw + timedelta(days=1), time(6, 0, 0), tzinfo=IST)
        return {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
            "label": "Tomorrow Night",
            "is_current": False,
            "target_time": "tomorrow night"
        }

    # Case: TOMORROW (Full Day 00:00 - 23:59:59)
    if norm_target in ["tomorrow", "tmrw", "next day"]:
        tmrw = ref_date + timedelta(days=1)
        start_dt = datetime.combine(tmrw, time(0, 0, 0), tzinfo=IST)
        end_dt = datetime.combine(tmrw, time(23, 59, 59), tzinfo=IST)
        return {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
            "label": "Tomorrow",
            "is_current": False,
            "target_time": "tomorrow"
        }

    # Case: TODAY MORNING (06:00 - 12:00)
    if norm_target in ["today morning", "this morning"]:
        start_dt = datetime.combine(ref_date, time(6, 0, 0), tzinfo=IST)
        end_dt = datetime.combine(ref_date, time(12, 0, 0), tzinfo=IST)
        return {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
            "label": "Today Morning",
            "is_current": False,
            "target_time": "today morning"
        }

    # Case: TODAY AFTERNOON (12:00 - 17:00)
    if norm_target in ["today afternoon", "this afternoon"]:
        start_dt = datetime.combine(ref_date, time(12, 0, 0), tzinfo=IST)
        end_dt = datetime.combine(ref_date, time(17, 0, 0), tzinfo=IST)
        return {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
            "label": "Today Afternoon",
            "is_current": False,
            "target_time": "today afternoon"
        }

    # Case: TODAY EVENING (17:00 - 22:00)
    if norm_target in ["today evening", "this evening"]:
        start_dt = datetime.combine(ref_date, time(17, 0, 0), tzinfo=IST)
        end_dt = datetime.combine(ref_date, time(22, 0, 0), tzinfo=IST)
        return {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
            "label": "Today Evening",
            "is_current": False,
            "target_time": "today evening"
        }

    # Case: TODAY NIGHT / TONIGHT (22:00 - 06:00 next day)
    if norm_target in ["today night", "this night", "tonight"]:
        start_dt = datetime.combine(ref_date, time(22, 0, 0), tzinfo=IST)
        end_dt = datetime.combine(ref_date + timedelta(days=1), time(6, 0, 0), tzinfo=IST)
        return {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
            "label": "Tonight",
            "is_current": False,
            "target_time": "today night"
        }

    # Case: NEXT 24 HOURS (ref through ref + 24 hours)
    if norm_target in ["next 24 hours", "next_24h", "24 hours", "24h"]:
        start_dt = ref
        end_dt = ref + timedelta(hours=24)
        return {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
            "label": "Next 24 Hours",
            "is_current": False,
            "target_time": "next 24 hours"
        }

    # Case: NEXT 48 HOURS (ref through ref + 48 hours)
    if norm_target in ["next 48 hours", "next_48h", "48 hours", "48h", "weekend"]:
        start_dt = ref
        end_dt = ref + timedelta(hours=48)
        return {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
            "label": "Next 48 Hours",
            "is_current": False,
            "target_time": "next 48 hours"
        }

    # Default Case: TODAY (current hour through end of local day)
    today_start = ref.replace(minute=0, second=0, microsecond=0)
    today_end = datetime.combine(ref_date, time(23, 59, 59), tzinfo=IST)
    label = "Today"
    # If already at the very end of today (e.g. within 2 hours of midnight), extend window into early morning
    if (today_end - ref).total_seconds() < 7200:
        today_end = ref + timedelta(hours=6)
        label = "Tonight / Early Morning"
    return {
        "start": today_start.isoformat(),
        "end": today_end.isoformat(),
        "label": label,
        "is_current": False,
        "target_time": "today"
    }


def filter_forecast_by_timerange(
    hourly_forecast: Dict[str, Any],
    time_range: Dict[str, Any]
) -> Dict[str, Any]:
    """Filters forecast series against the specified [start, end] window and computes maxima.
    
    Args:
        hourly_forecast: Dict containing parallel lists:
            - 'times': ISO-like timestamp strings
            - 'wind_speed_kmh': floats
            - 'wave_height_m': floats
            - 'wind_gust_kmh': floats (optional)
            - 'weather_code': ints (optional)
        time_range: Dict with 'start' and 'end' ISO strings
        
    Returns:
        Dict summarizing window evaluation:
            - 'matched_points': number of forecast points inside the window
            - 'max_wind_kmh': peak sustained wind
            - 'max_gust_kmh': peak gust
            - 'max_wave_m': peak significant wave height
            - 'has_storm_alert': boolean flag
            - 'storm_description': storm note if triggered
            - 'evaluated_timestamps': list of matched timestamp strings
    """
    start_dt = parse_iso_datetime(time_range["start"])
    end_dt = parse_iso_datetime(time_range["end"])

    times = hourly_forecast.get("times", [])
    winds = hourly_forecast.get("wind_speed_kmh", [])
    waves = hourly_forecast.get("wave_height_m", [])
    gusts = hourly_forecast.get("wind_gusts_kmh", hourly_forecast.get("wind_gust_kmh", []))
    codes = hourly_forecast.get("weather_code", [])
    temps = hourly_forecast.get("temperature_c", hourly_forecast.get("temperature_2m", []))
    precips = hourly_forecast.get("precipitation_mm", hourly_forecast.get("precipitation", []))

    matched_indices = []
    matched_timestamps = []

    for i, t_str in enumerate(times):
        try:
            pt_dt = parse_iso_datetime(t_str)
            if start_dt <= pt_dt <= end_dt:
                matched_indices.append(i)
                matched_timestamps.append(t_str)
        except Exception:
            continue

    if not matched_indices:
        return {
            "matched_points": 0,
            "max_wind_kmh": None,
            "max_gust_kmh": None,
            "max_wave_m": None,
            "has_storm_alert": False,
            "storm_description": "",
            "evaluated_timestamps": [],
            "filtered_series": {
                "times": [],
                "wind_speed_kmh": [],
                "wave_height_m": [],
                "wind_gust_kmh": [],
                "temperature_c": [],
                "precipitation_mm": []
            }
        }

    m_winds = [winds[i] for i in matched_indices if i < len(winds) and winds[i] is not None]
    m_waves = [waves[i] for i in matched_indices if i < len(waves) and waves[i] is not None]
    m_gusts = [gusts[i] for i in matched_indices if i < len(gusts) and gusts[i] is not None]
    m_codes = [codes[i] for i in matched_indices if i < len(codes) and codes[i] is not None]
    m_temps = [temps[i] for i in matched_indices if i < len(temps) and temps[i] is not None]
    m_precips = [precips[i] for i in matched_indices if i < len(precips) and precips[i] is not None]

    max_wind = round(float(max(m_winds)), 1) if m_winds else None
    max_wave = round(float(max(m_waves)), 2) if m_waves else None
    max_gust = round(float(max(m_gusts)), 1) if m_gusts else None
    
    # Storm detection: WMO 95 (thunderstorm), 96 (thunderstorm with hail), 99 (severe thunderstorm)
    # or extreme sustained winds (>60 km/h)
    has_storm = any(c in [95, 96, 99] for c in m_codes) or (max_wind is not None and max_wind > 60.0)
    storm_desc = ""
    if has_storm:
        storm_desc = "Thunderstorm / High Sea Alert in requested forecast window"

    filtered_series = {
        "times": matched_timestamps,
        "wind_speed_kmh": [round(float(w), 1) for w in m_winds],
        "wave_height_m": [round(float(w), 2) for w in m_waves],
        "wind_gust_kmh": [round(float(g), 1) for g in m_gusts],
        "temperature_c": [round(float(t), 1) for t in m_temps],
        "precipitation_mm": [round(float(p), 1) for p in m_precips]
    }

    return {
        "matched_points": len(matched_indices),
        "max_wind_kmh": max_wind,
        "max_gust_kmh": max_gust,
        "max_wave_m": max_wave,
        "has_storm_alert": has_storm,
        "storm_description": storm_desc,
        "evaluated_timestamps": matched_timestamps,
        "filtered_series": filtered_series
    }
