export const format = (urlObj: any) => {
	if (typeof urlObj === "string") return urlObj;
	const { protocol, host, pathname, search, hash } = urlObj;
	let url = "";
	if (protocol) url += protocol + (protocol.endsWith(":") ? "//" : "://");
	if (host) url += host;
	if (pathname) url += pathname;
	if (search) url += search;
	if (hash) url += hash;
	return url;
};

export const parse = (urlStr: string) => {
	return new URL(urlStr);
};

export const resolve = (from: string, to: string) => {
	return new URL(to, from).href;
};

export default { format, parse, resolve };
