import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en, uz, ru } from '@expouz/shared';

const resources = {
  en: { translation: en },
  uz: { translation: uz },
  ru: { translation: ru },
};

// Initialize synchronously at module load so react-i18next is ready before
// any component renders (calling initI18n inside useEffect causes i18next to
// be uninitialized on the first render, breaking hook order in useTranslation).
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'uz',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v3',
  });

export function initI18n(language: 'en' | 'uz' | 'ru' = 'uz') {
  if (!i18n.isInitialized) {
    // Should not happen since init runs at module load, but guard just in case.
    return;
  }
  i18n.changeLanguage(language);
}

export default i18n;
