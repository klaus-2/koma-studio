"""Language detection and normalization helpers for Discord replies."""

from __future__ import annotations

from dataclasses import dataclass
import re

from langdetect import DetectorFactory, LangDetectException, detect_langs


DetectorFactory.seed = 0

SUPPORTED_RESPONSE_LANGUAGES: dict[str, str] = {
    "ar": "Arabic",
    "de": "German",
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "hi": "Hindi",
    "it": "Italian",
    "ja": "Japanese",
    "ko": "Korean",
    "pt": "Portuguese",
    "pt-br": "Brazilian Portuguese",
    "ru": "Russian",
    "zh": "Chinese",
    "zh-tw": "Traditional Chinese",
}
LOCALE_NORMALIZATION_MAP = {
    "pt_br": "pt-br",
    "pt-br": "pt-br",
    "pt": "pt-br",
    "zh_cn": "zh",
    "zh-cn": "zh",
    "zh": "zh",
    "zh_hant": "zh-tw",
    "zh-hant": "zh-tw",
    "zh_tw": "zh-tw",
    "zh-tw": "zh-tw",
    "ja_jp": "ja",
    "ko_kr": "ko",
    "en_us": "en",
    "en_gb": "en",
}
UNKNOWN_MESSAGES = {
    "ar": "همم، لم أجد هذه المعلومة في قاعدة بياناتي عن Koma Studio. ربما يستطيع أحد المشرفين مساعدتك بشكل أفضل! 💡",
    "de": "Hm, ich habe diese Information nicht in meiner Wissensbasis über Koma Studio gefunden. Vielleicht kann dir ein Administrator besser helfen! 💡",
    "en": "Hmm, I couldn't find that information in my Koma Studio knowledge base. An admin might be able to help you better! 💡",
    "es": "Hmm, no encontré esa información en mi base de datos sobre Koma Studio. ¡Tal vez un administrador pueda ayudarte mejor! 💡",
    "fr": "Hmm, je n'ai pas trouvé cette information dans ma base de connaissances sur Koma Studio. Un administrateur pourra peut-être mieux t'aider ! 💡",
    "hi": "हम्म, मुझे Koma Studio के बारे में अपने नॉलेज बेस में यह जानकारी नहीं मिली। शायद कोई एडमिन आपकी बेहतर मदद कर सके! 💡",
    "it": "Hmm, non ho trovato questa informazione nel mio database su Koma Studio. Forse un amministratore può aiutarti meglio! 💡",
    "ja": "うーん、Koma Studio の知識ベースではその情報が見つかりませんでした。必要なら管理者のほうが詳しく案内できるかもしれません。💡",
    "ko": "흠, Koma Studio 지식 베이스에서는 그 정보를 찾지 못했어요. 필요하면 관리자에게 문의하는 편이 더 정확할 수 있어요! 💡",
    "pt-br": "Hmm, não encontrei essa informação no meu banco de dados sobre o Koma Studio. Talvez um administrador possa te ajudar melhor! 💡",
    "ru": "Хм, я не нашёл эту информацию в своей базе знаний о Koma Studio. Возможно, администратор сможет помочь лучше! 💡",
    "zh": "嗯，我在 Koma Studio 的知识库里没有找到这条信息。也许管理员能更好地帮助你！💡",
    "zh-tw": "嗯，我在 Koma Studio 的知識庫裡沒有找到這項資訊。也許管理員能更好地幫助你！💡",
}
TIMEOUT_MESSAGES = {
    "ar": "لحظة من فضلك، ما زلت أعالج طلبك...",
    "de": "Einen Moment bitte, ich bearbeite deine Anfrage noch...",
    "en": "One moment please, I'm still processing your request...",
    "es": "Un momento, todavía estoy procesando tu solicitud...",
    "fr": "Un instant, je traite encore ta demande...",
    "hi": "एक क्षण, मैं अभी आपकी रिक्वेस्ट प्रोसेस कर रहा हूँ...",
    "it": "Un momento, sto ancora elaborando la tua richiesta...",
    "ja": "少々お待ちください。まだリクエストを処理しています...",
    "ko": "잠시만요, 아직 요청을 처리하고 있어요...",
    "pt-br": "Aguarde um momento, estou processando sua solicitação...",
    "ru": "Секунду, я всё ещё обрабатываю ваш запрос...",
    "zh": "请稍等，我还在处理你的请求...",
    "zh-tw": "請稍等，我還在處理你的請求...",
}

ARABIC_RE = re.compile(r"[\u0600-\u06FF]")
HIRAGANA_KATAKANA_RE = re.compile(r"[\u3040-\u30FF]")
HANGUL_RE = re.compile(r"[\uAC00-\uD7AF]")
CYRILLIC_RE = re.compile(r"[\u0400-\u04FF]")
CJK_RE = re.compile(r"[\u4E00-\u9FFF]")
LATIN_WORD_RE = re.compile(r"[a-zà-ÿ']{2,}", re.IGNORECASE)
LANGUAGE_STOPWORDS: dict[str, set[str]] = {
    "pt-br": {
        "como", "posso", "quero", "depois", "traduzir", "balões", "balão", "fala",
        "novo", "projeto", "crio", "criar", "usar", "ferramenta", "ajuda", "capítulo",
        "limpo", "removo", "texto", "antigo", "baixar", "modelos", "adicionais",
        "limpeza", "imagem", "imagens", "primeiro", "passo", "guia", "onde", "porque",
        "não", "nao", "você", "voce", "estou", "ainda", "devo", "logo", "após", "apos",
    },
    "en": {
        "how", "do", "i", "use", "after", "translate", "clean", "speech", "bubbles",
        "old", "text", "first", "project", "new", "start", "chapter", "download",
        "models", "image", "images", "tool", "help", "where", "why", "still",
    },
    "es": {
        "como", "puedo", "usar", "después", "traducir", "limpiar", "globos", "texto",
        "proyecto", "capítulo", "nuevo", "ayuda", "imagen", "imágenes", "descargar",
        "modelos", "quiero", "todavía", "debo",
    },
    "fr": {
        "comment", "puis", "utiliser", "après", "traduire", "nettoyer", "bulles",
        "texte", "projet", "chapitre", "nouveau", "aide", "image", "images", "télécharger",
        "modèles",
    },
    "de": {
        "wie", "kann", "ich", "verwenden", "nach", "übersetzen", "blasen", "text",
        "projekt", "kapitel", "neu", "hilfe", "bild", "bilder", "modelle", "herunterladen",
    },
    "it": {
        "come", "posso", "usare", "dopo", "tradurre", "pulire", "fumetti", "testo",
        "progetto", "capitolo", "nuovo", "aiuto", "immagine", "immagini", "scaricare",
        "modelli",
    },
}


@dataclass(slots=True)
class LanguagePreference:
    """Detected language plus a human-readable label."""

    code: str
    label: str


def normalize_locale_code(value: str | None, default: str = "en") -> str:
    """Normalize locale codes to the subset supported by the bot."""
    if not value:
        return default
    normalized = value.strip().lower().replace("_", "-")
    normalized = LOCALE_NORMALIZATION_MAP.get(normalized, normalized)
    if normalized in SUPPORTED_RESPONSE_LANGUAGES:
        return normalized
    if "-" in normalized:
        base = normalized.split("-", 1)[0]
        return LOCALE_NORMALIZATION_MAP.get(base, base if base in SUPPORTED_RESPONSE_LANGUAGES else default)
    return normalized if normalized in SUPPORTED_RESPONSE_LANGUAGES else default


def detect_language(text: str, preferred_locale: str | None = None) -> LanguagePreference:
    """Detect the language of an arbitrary user message."""
    cleaned = text.strip()
    if not cleaned:
        normalized = normalize_locale_code(preferred_locale, default="en")
        return LanguagePreference(code=normalized, label=SUPPORTED_RESPONSE_LANGUAGES[normalized])

    script_guess = _guess_language_by_script(cleaned)
    if script_guess:
        return LanguagePreference(code=script_guess, label=SUPPORTED_RESPONSE_LANGUAGES[script_guess])

    lexical_guess = _guess_language_by_stopwords(cleaned)
    if lexical_guess:
        normalized = normalize_locale_code(lexical_guess, default="en")
        return LanguagePreference(code=normalized, label=SUPPORTED_RESPONSE_LANGUAGES[normalized])

    if len(cleaned) < 12:
        normalized = normalize_locale_code(preferred_locale, default="en")
        return LanguagePreference(code=normalized, label=SUPPORTED_RESPONSE_LANGUAGES[normalized])

    try:
        ranked = detect_langs(cleaned)
    except LangDetectException:
        normalized = normalize_locale_code(preferred_locale, default="en")
        return LanguagePreference(code=normalized, label=SUPPORTED_RESPONSE_LANGUAGES[normalized])

    detected_code = normalize_locale_code(ranked[0].lang if ranked else preferred_locale, default="en")
    return LanguagePreference(code=detected_code, label=SUPPORTED_RESPONSE_LANGUAGES[detected_code])


def detect_answer_language(text: str, requested_locale: str) -> LanguagePreference:
    """Detect the actual output language, biased toward the requested locale."""
    lexical_guess = _guess_language_by_stopwords(text)
    if lexical_guess:
        normalized = normalize_locale_code(lexical_guess, default=requested_locale)
        return LanguagePreference(code=normalized, label=SUPPORTED_RESPONSE_LANGUAGES[normalized])
    detected = detect_language(text, preferred_locale=requested_locale)
    return detected


def localized_unknown_message(language_code: str) -> str:
    """Return the localized knowledge-miss message."""
    normalized = normalize_locale_code(language_code, default="en")
    return UNKNOWN_MESSAGES.get(normalized, UNKNOWN_MESSAGES["en"])


def localized_timeout_message(language_code: str) -> str:
    """Return the localized timeout message."""
    normalized = normalize_locale_code(language_code, default="en")
    return TIMEOUT_MESSAGES.get(normalized, TIMEOUT_MESSAGES["en"])


def _guess_language_by_script(text: str) -> str | None:
    """Quick script-based guess for languages that are easy to identify."""
    if HIRAGANA_KATAKANA_RE.search(text):
        return "ja"
    if HANGUL_RE.search(text):
        return "ko"
    if ARABIC_RE.search(text):
        return "ar"
    if CYRILLIC_RE.search(text):
        return "ru"
    if CJK_RE.search(text):
        return "zh"
    return None


def _guess_language_by_stopwords(text: str) -> str | None:
    """Infer language from frequent stopwords for Latin-script languages."""
    words = [word.casefold() for word in LATIN_WORD_RE.findall(text)]
    if not words:
        return None

    scores: dict[str, int] = {}
    for language_code, stopwords in LANGUAGE_STOPWORDS.items():
        scores[language_code] = sum(1 for word in words if word in stopwords)

    best_language = max(scores, key=scores.get)
    best_score = scores[best_language]
    second_score = max((score for code, score in scores.items() if code != best_language), default=0)

    if best_score >= 2 and best_score >= second_score + 1:
        return best_language
    return None
