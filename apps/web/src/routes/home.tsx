import type { Route } from './+types/home';
import { seo } from '@/lib/seo';
import { Navbar } from '@/components/home/navbar';
import { Hero } from '@/components/home/hero';
import { Features } from '@/components/home/features';
import { HowItWorks } from '@/components/home/how-it-works';
import { Stats } from '@/components/home/stats';
import { Testimonials } from '@/components/home/testimonials';
import { Pricing } from '@/components/home/pricing';
import { Faq } from '@/components/home/faq';
import { FinalCta } from '@/components/home/final-cta';
import { SiteFooter } from '@/components/site-footer';

export function meta({ matches, location }: Route.MetaArgs) {
	return seo(
		{ matches, location },
		{
			title: 'LectureLift — Turn Any Lecture Into Notes, Flashcards & Quizzes',
			description:
				'Upload a lecture recording (MP3/MP4) and automatically get a transcript, structured revision notes, flashcards, a multiple-choice quiz and an interactive mind map.',
		},
	);
}

export default function Home() {
	return (
		<div className="min-h-[100dvh]">
			<Navbar />
			<main>
				<Hero />
				<Features />
				<HowItWorks />
				<Stats />
				<Testimonials />
				<Pricing />
				<Faq />
				<FinalCta />
			</main>
			<SiteFooter />
		</div>
	);
}
