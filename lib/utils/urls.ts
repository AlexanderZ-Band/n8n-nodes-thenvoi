import { BandCredentials } from '../types';

export const URL_PROTOCOLS = {
	WEBSOCKET: 'wss',
	HTTP: 'https',
	HTTP_INSECURE: 'http',
} as const;

export const URL_PATHS = { WEBSOCKET: '/socket', HTTP: '' } as const;

/** Normalize before any HTTP or WebSocket request; query authentication is never sent. */
function parseServerUrl(serverUrl: string): URL {
	try {
		if (
			(/^[a-z][a-z0-9+.-]*:\/\//i.test(serverUrl) && !/^https?:\/\//i.test(serverUrl)) ||
			serverUrl.includes('#')
		)
			throw new Error();
		const url = new URL(/^https?:\/\//i.test(serverUrl) ? serverUrl : `https://${serverUrl}`);
		for (const key of [...url.searchParams.keys()]) {
			if (['api_key', 'token'].includes(key.toLowerCase())) url.searchParams.delete(key);
		}
		if (
			!['http:', 'https:'].includes(url.protocol) ||
			url.username ||
			url.password ||
			url.search ||
			url.hash
		) {
			throw new Error();
		}
		url.pathname = url.pathname.replace(/\/+$/, '');
		return url;
	} catch {
		throw new Error(
			'Invalid Band server URL: use a host and API base path without query parameters, fragments or user information.',
		);
	}
}

export function getSocketUrl(serverUrl: string): string {
	const url = parseServerUrl(serverUrl);
	url.protocol = `${URL_PROTOCOLS.WEBSOCKET}:`;
	url.pathname = url.pathname.replace(/\/+$/, '') + URL_PATHS.WEBSOCKET;
	return url.toString();
}

export function getHttpUrl(credentials: BandCredentials, useHttps: boolean = true): string {
	const url = parseServerUrl(credentials.serverUrl);
	url.protocol = `${useHttps ? URL_PROTOCOLS.HTTP : URL_PROTOCOLS.HTTP_INSECURE}:`;
	return url.toString().replace(/\/$/, '');
}
