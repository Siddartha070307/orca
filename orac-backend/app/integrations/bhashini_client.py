"""Bhashini ULCA API integration for Indian language detection & translation."""
import logging
import re
from typing import Tuple
import httpx
from app.core.config import settings
from app.integrations.claude_client import claude_client

logger = logging.getLogger(__name__)


class BhashiniClient:
    """Client for Bhashini ULCA / Dhruva inference pipeline with Claude and graceful fallback."""

    def __init__(self, timeout: float = 6.0):
        self.user_id = settings.BHASHINI_USER_ID
        self.api_key = settings.BHASHINI_API_KEY
        self.pipeline_id = settings.BHASHINI_PIPELINE_ID
        self.endpoint_url = settings.BHASHINI_ULCA_URL
        self.timeout = timeout
        self.last_ingress_status = "original"
        self.last_egress_status = "original"

    def detect_script_heuristics(self, text: str) -> str:
        """Quick unicode block detection for Indian languages when offline."""
        for ch in text:
            code = ord(ch)
            if 0x0900 <= code <= 0x097F:
                return "hi"  # Devanagari (Hindi / Marathi)
            elif 0x0C80 <= code <= 0x0CFF:
                return "kn"  # Kannada
            elif 0x0B80 <= code <= 0x0BFF:
                return "ta"  # Tamil
            elif 0x0C00 <= code <= 0x0C7F:
                return "te"  # Telugu
            elif 0x0D00 <= code <= 0x0D7F:
                return "ml"  # Malayalam
            elif 0x0980 <= code <= 0x09FF:
                return "bn"  # Bengali / Assamese
            elif 0x0A80 <= code <= 0x0AFF:
                return "gu"  # Gujarati
            elif 0x0B00 <= code <= 0x0B7F:
                return "or"  # Odia
            elif 0x0A00 <= code <= 0x0A7F:
                return "pa"  # Gurmukhi (Punjabi)
        return "en"

    async def detect_and_translate_to_english(self, text: str, user_specified_lang: str = None) -> Tuple[str, str]:
        """Detects language and translates to English if necessary using Bhashini -> Claude -> fallback chain.
        
        Returns:
            (detected_language, english_translated_text)
        """
        detected_lang = user_specified_lang or self.detect_script_heuristics(text)

        # If already English, return directly
        if detected_lang == "en":
            self.last_ingress_status = "original"
            return "en", text

        # 1. Attempt live Bhashini translation if credentials available
        if self.user_id and self.api_key:
            try:
                translated = await self._call_bhashini_nmt(text, source_lang=detected_lang, target_lang="en")
                if translated and translated.strip():
                    self.last_ingress_status = "translated"
                    return detected_lang, translated.strip()
            except Exception as e:
                logger.warning(f"Bhashini translation to English failed, falling back: {e}")

        # 2. Fallback to Claude translation
        try:
            translated = await claude_client.translate_text(text, source_lang=detected_lang, target_lang="en")
            if translated and translated.strip():
                self.last_ingress_status = "translated"
                return detected_lang, translated.strip()
        except Exception as e:
            logger.warning(f"Claude fallback translation from {detected_lang} to English failed: {e}")

        # 3. Final Fallback: if both fail, return text as-is with detected language tag
        self.last_ingress_status = "fallback_en"
        return detected_lang, text

    async def translate_from_english_with_status(self, text: str, target_lang: str) -> Tuple[str, str]:
        """Translates final English response back to target Indian language with status tag.
        
        Returns:
            (translated_text, status) where status is 'original', 'translated', or 'fallback_en'
        """
        if not target_lang or target_lang == "en":
            self.last_egress_status = "original"
            return text, "original"

        # 1. Attempt live Bhashini translation if credentials available
        if self.user_id and self.api_key:
            try:
                translated = await self._call_bhashini_nmt(text, source_lang="en", target_lang=target_lang)
                if translated and translated.strip():
                    self.last_egress_status = "translated"
                    return translated.strip(), "translated"
            except Exception as e:
                logger.warning(f"Bhashini translation from English to {target_lang} failed: {e}")

        # 2. Fallback to Claude translation
        try:
            translated = await claude_client.translate_text(text, source_lang="en", target_lang=target_lang)
            if translated and translated.strip():
                self.last_egress_status = "translated"
                return translated.strip(), "translated"
        except Exception as e:
            logger.warning(f"Claude fallback translation from English to {target_lang} failed: {e}")

        # 3. Final Fallback: return English text with fallback_en status
        self.last_egress_status = "fallback_en"
        return text, "fallback_en"

    async def translate_from_english(self, text: str, target_lang: str) -> str:
        """Translates final English response back to target Indian language."""
        translated, _ = await self.translate_from_english_with_status(text, target_lang)
        return translated

    async def _call_bhashini_nmt(self, text: str, source_lang: str, target_lang: str) -> str:
        """Invokes Bhashini ULCA Dhruva NMT inference."""
        headers = {
            "Content-Type": "application/json",
            "userID": self.user_id,
            "ulcaApiKey": self.api_key
        }
        payload = {
            "pipelineTasks": [
                {
                    "taskType": "translation",
                    "config": {
                        "language": {
                            "sourceLanguage": source_lang,
                            "targetLanguage": target_lang
                        }
                    }
                }
            ],
            "inputData": {
                "input": [{"source": text}]
            }
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(self.endpoint_url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                output_list = data.get("pipelineResponse", [{}])[0].get("output", [])
                if output_list:
                    return output_list[0].get("target", "")
        return ""


bhashini_client = BhashiniClient()
