export const getGeniusKeyGuideUrl = (language?: string) => {
	const locale = language?.split("-")[0].toLowerCase();
	const prefix = locale === "it" || locale === "es" ? `${locale}/` : "";
	return `https://docs.tx24.dev/${prefix}guides/ttml.html#genius-api-key`;
};
