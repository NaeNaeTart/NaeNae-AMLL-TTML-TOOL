declare module "compromise/tokenize" {
	import type compromise from "compromise";
	const tokenize: typeof compromise;
	export default tokenize;
}

declare module "compromise-speech" {
	const plugin: unknown;
	export default plugin;
}

declare module "silabas" {
	const silabas: (word: string) => { syllables: () => string[] };
	export default silabas;
}

declare module "syllabify" {
	const syllabify: (word: string) => string[];
	export default syllabify;
}
