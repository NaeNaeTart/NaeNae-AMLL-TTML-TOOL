import resources from "virtual:i18next-loader";
import i18n from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";

// en-US is the source language: new keys land there first, then Crowdin
// translates them.
type TranslationResource = typeof import("./locales/en-US/translation.json");

declare module "i18next" {
	interface CustomTypeOptions {
		resources: {
			translation: TranslationResource;
		};
		defaultNS: "translation";
		returnNull: false;
		allowedKeys: keyof TranslationResource;
	}
}

i18n
	.use(initReactI18next)
	.use(ICU)
	.init({
		resources,
		debug: import.meta.env.DEV,
		fallbackLng: "en-US",
		interpolation: {
			escapeValue: false,
		},
		returnNull: false,
	})
	.then(() =>
		i18n.changeLanguage(localStorage.getItem("language") || navigator.language),
	);

export default i18n;
