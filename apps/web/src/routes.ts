import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
	index('routes/home.tsx'),
	route('login', 'routes/login.tsx'),
	route('signup', 'routes/signup.tsx'),
	route('forgot-password', 'routes/forgot-password.tsx'),
	route('dashboard', 'routes/dashboard.tsx', [
		index('routes/dashboard.overview.tsx'),
		route('upload', 'routes/dashboard.upload.tsx'),
		route('lectures', 'routes/dashboard.lectures.tsx'),
		route('lectures/:id', 'routes/dashboard.lecture.$id.tsx'),
		route('study', 'routes/dashboard.study.tsx'),
		route('settings', 'routes/dashboard.settings.tsx'),
	]),
	route('sitemap.xml', 'routes/sitemap.xml.ts'),
	route('robots.txt', 'routes/robots.txt.ts'),
	route('api/health', 'routes/api.health.ts'),
	route('api/process-lecture', 'routes/api.process-lecture.ts'),
	route('api/integrated-ai/stream', 'routes/api.integrated-ai.stream.ts'),
	route('api/*', 'routes/api.$.ts'),
	route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
