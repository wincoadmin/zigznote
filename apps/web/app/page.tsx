import {
  Navbar,
  Hero,
  TrustIndicators,
  HowItWorks,
  Features,
  SearchSection,
  AIAssistant,
  Integrations,
  PricingTeaser,
  Testimonials,
  FAQ,
  Footer,
} from '@/components/landing';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <Hero />
      <TrustIndicators />
      <HowItWorks />
      <Features />
      <SearchSection />
      <AIAssistant />
      <Integrations />
      <PricingTeaser />
      <Testimonials />
      <FAQ />
      <Footer />
    </div>
  );
}
