import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en, uz, ru } from '@fubles-uz/shared';

const resources = {
  en: { translation: en },
  uz: { translation: uz },
  ru: { translation: ru },
};

export function initI18n(language: 'en' | 'uz' | 'ru' = 'uz') {
  if (i18n.isInitialized) {
    i18n.changeLanguage(language);
    return;
  }

  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: language,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v3',
    });
}

export default i18n;
