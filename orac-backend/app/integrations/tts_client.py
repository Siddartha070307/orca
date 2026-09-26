"""Text-to-Speech (TTS) integration with swappable provider interface."""
import io
import re
import logging
from abc import ABC, abstractmethod
from typing import Optional, Set
try:
    from gtts import gTTS
except ImportError:
    gTTS = None

logger = logging.getLogger(__name__)


def strip_markdown_for_tts(text: str) -> str:
    """Strips markdown syntax, emojis, and normalizes text for speech synthesis."""
    if not text:
        return ""
    # Remove code blocks
    text = re.sub(r"```[\s\S]*?```", "", text)
    text = re.sub(r"`[^`]+`", "", text)
    # Remove images and links
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    # Remove header markers
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    # Remove bold / italic markers
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"__([^_]+)__", r"\1", text)
    text = re.sub(r"_([^_]+)_", r"\1", text)
    # Remove table markup
    text = re.sub(r"\|[\s:\-]+\|[\s|\-:]*", "", text)
    text = re.sub(r"\|", ", ", text)
    # Bullet points to pauses
    text = re.sub(r"^[\s*+-]+\s+", ". ", text, flags=re.MULTILINE)
    # Clean whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


class TTSProvider(ABC):
    """Abstract interface for speech synthesis providers."""

    @abstractmethod
    def is_language_supported(self, language: str) -> bool:
        """Returns True if the provider supports high-quality speech for this language."""
        pass

    @abstractmethod
    def synthesize_speech(self, text: str, language: str) -> Optional[bytes]:
        """Synthesizes MP3 audio bytes for the given text and language code."""
        pass


class GTTSProvider(TTSProvider):
    """Google Translate TTS implementation — free, keyless, and robust for standard Indic languages.
    
    Supported: en, hi, ta, te, kn, ml, mr, bn, gu, pa.
    Unsupported by gTTS: or (Odia), as (Assamese) — fallback to browser SpeechSynthesis.
    """

    # Validated gTTS language codes
    SUPPORTED_LANGS: Set[str] = {
        "en", "hi", "ta", "te", "kn", "ml", "mr", "bn", "gu", "pa"
    }

    # BCP-47 to gTTS mapping
    LANG_MAP = {
        "en": "en",
        "hi": "hi",
        "ta": "ta",
        "te": "te",
        "kn": "kn",
        "ml": "ml",
        "mr": "mr",
        "bn": "bn",
        "gu": "gu",
        "pa": "pa"
    }

    def is_language_supported(self, language: str) -> bool:
        norm = (language or "").lower().strip()
        return norm in self.SUPPORTED_LANGS

    def synthesize_speech(self, text: str, language: str) -> Optional[bytes]:
        clean_text = strip_markdown_for_tts(text)
        if not clean_text:
            return None

        norm_lang = (language or "en").lower().strip()
        target_lang = self.LANG_MAP.get(norm_lang)
        if not target_lang:
            logger.warning(f"Language '{language}' is not supported by gTTS (e.g. Odia/Assamese fallback).")
            return None

        if gTTS is None:
            logger.warning("gTTS library is not available in environment.")
            return None

        try:
            # Keep audio concise if advisory report is very lengthy
            if len(clean_text) > 1200:
                clean_text = clean_text[:1200].rsplit(".", 1)[0] + "."

            tts = gTTS(text=clean_text, lang=target_lang, slow=False)
            mp3_fp = io.BytesIO()
            tts.write_to_fp(mp3_fp)
            mp3_fp.seek(0)
            return mp3_fp.getvalue()
        except Exception as e:
            logger.error(f"gTTS audio synthesis failed for language {language}: {e}")
            return None


tts_provider = GTTSProvider()
