const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

const parseConfiguredOrigin = (value: string): URL => {
	let origin: URL;
	try {
		origin = new URL(value);
	} catch {
		throw new Error('PUBLIC_SITE_ORIGIN must be a valid absolute URL.');
	}

	if (
		origin.username
		|| origin.password
		|| origin.pathname !== '/'
		|| origin.search
		|| origin.hash
		|| (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && LOCAL_HOSTNAMES.has(origin.hostname)))
	) {
		throw new Error('PUBLIC_SITE_ORIGIN must be an HTTPS origin (HTTP is allowed only for localhost).');
	}

	return origin;
};

/**
 * The public origin of this site, e.g. `https://example.com`. Use it for
 * absolute URLs that leave the app — sitemap `<loc>`, canonical links, `og:url`.
 *
 * The scheme comes from the hostname because the request cannot report it: TLS
 * terminates at the proxy, so `request.url` and `X-Forwarded-Proto` both say
 * `http` even for a visitor who arrived over HTTPS. Trusting either publishes
 * `http://` URLs that only redirect, which search engines index as a second,
 * duplicate site. Every host this app is reachable on serves HTTPS except a
 * local `npm run start`, which is where the `curl` checks in the SEO skill run.
 *
 * `Host` carries the public domain, and only the origin is read, so the `.data`
 * suffix React Router adds to `request.url` on client navigations does not
 * matter.
 */
export const siteOrigin = (request: Request): string => {
	const { host, hostname } = new URL(request.url);

	return `${LOCAL_HOSTNAMES.has(hostname) ? 'http' : 'https'}://${host}`;
};

/**
 * Trusted origin for payment callbacks. Hosted deployments must configure
 * PUBLIC_SITE_ORIGIN because request headers may contain an internal proxy host.
 * Local development keeps using the request origin for localhost URLs.
 */
export const trustedSiteOrigin = (request: Request): string => {
	const configuredOrigin = process.env.PUBLIC_SITE_ORIGIN;
	if (configuredOrigin) {
		return parseConfiguredOrigin(configuredOrigin).origin;
	}

	const { hostname } = new URL(request.url);
	if (!LOCAL_HOSTNAMES.has(hostname)) {
		throw new Error('PUBLIC_SITE_ORIGIN must be configured for hosted deployments.');
	}

	return siteOrigin(request);
};
