// The 10 supported languages (spec §B.11, user-confirmed final list — the
// 10th slot went to Dutch, NOT Japanese). 'en' is the base language: content
// is finalized in English first; every other language is translated FROM it.
//
// register: the per-language formality register (ported from the reference
// repo's _REGISTER_BY_LANG), injected verbatim into the translation prompt so
// the model is told exactly which register to hold instead of inferring it.

export const BASE_LANGUAGE = 'en';

export const LANGUAGES = [
  { id: 'en', label: 'English', register: null }, // base — never translated
  { id: 'es', label: 'Spanish', register: 'the formal "usted" register (never "tú" or "vos"); imperatives in the usted form: "Verifique / Notifique" (default es-419 vocabulary)' },
  { id: 'pt-BR', label: 'Portuguese (Brazilian)', register: 'a respectful professional register using "você"; imperatives: "Verifique / Comunique"' },
  { id: 'zh-CN', label: 'Chinese (Simplified)', register: 'the formal "您" register (never "你"); Mainland terminology and Chinese punctuation' },
  { id: 'ko', label: 'Korean', register: 'the formal-polite 합니다체 register (never 반말); endings in -습니다/-십시오' },
  { id: 'uk', label: 'Ukrainian', register: 'the formal "Ви" register (never "ти"); «» guillemets for quotations' },
  { id: 'de', label: 'German', register: 'the formal "Sie" register (never "du"); imperatives: "Melden Sie / Klicken Sie nicht"; German capitalises ALL nouns, including English loanword nouns (Phishing, Malware) and compounds (Phishing-Angriff)' },
  { id: 'fr', label: 'French', register: 'the formal "vous" register (never "tu"); imperatives: "Vérifiez / Signalez"' },
  { id: 'nl', label: 'Dutch', register: 'the formal "u" register (never "je"/"jij"); imperatives: "Meld het / Klik niet"; loanword nouns capitalised consistently (Phishing, Phishingtactieken)' },
  { id: 'it', label: 'Italian', register: 'the formal "Lei" register (never "tu"); imperatives ONLY in the Lei form: "Verifichi / Segnali / Non clicchi" (never "Verifica / Segnala / Non cliccare") — a single tu-form in a Lei document is a defect' }
];

export const LANGUAGE_IDS = LANGUAGES.map((l) => l.id);
export const TARGET_LANGUAGE_IDS = LANGUAGE_IDS.filter((id) => id !== BASE_LANGUAGE);

export function getLanguage(id) {
  return LANGUAGES.find((l) => l.id === id) || null;
}

/** Register instruction for a target language (default for safety, ported). */
export function registerFor(id) {
  const lang = getLanguage(id);
  return lang?.register
    || 'the formal business register a native HR or compliance team would use in internal employee communications';
}
