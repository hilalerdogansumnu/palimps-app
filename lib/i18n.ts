import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "@/locales/en.json";
import tr from "@/locales/tr.json";

const LANGUAGE_KEY = "@palimps_language";

// Get saved language or default to English
const getInitialLanguage = async () => {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
    return savedLanguage || "en";
  } catch (error) {
    return "en";
  }
};

// Save language preference
export const saveLanguage = async (language: string) => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, language);
  } catch (error) {
    console.error("Failed to save language:", error);
  }
};

// Initialize i18n
const initI18n = async () => {
  const initialLanguage = await getInitialLanguage();

  i18n
    .use(initReactI18next)
    .init({
      compatibilityJSON: "v4",
      resources: {
        en: { translation: en },
        tr: { translation: tr },
      },
      lng: initialLanguage,
      fallbackLng: "en",
      interpolation: {
        escapeValue: false,
      },
    });
};

initI18n();

export default i18n;
