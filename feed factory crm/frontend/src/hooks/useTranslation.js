import { useState, useEffect, useCallback } from 'react';
import { t as translate, getLang, setLang, isRTL } from '../utils/i18n';

export function useTranslation() {
  const [lang, setLangState] = useState(getLang());

  const changeLanguage = useCallback((newLang) => {
    setLang(newLang);
    setLangState(newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
    // Force full page re-render to apply translations
    window.location.reload();
  }, []);

  const t = useCallback((key) => translate(key), [lang]);
  const isRtl = lang === 'ar';

  return { t, lang, isRtl, changeLanguage };
}

export default useTranslation;
