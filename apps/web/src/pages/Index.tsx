import HeroSection from "@/components/landing/HeroSection";
import ValueProposition from "@/components/landing/ValueProposition";
import FeaturesSection from "@/components/landing/FeaturesSection";
import FeaturedEvents from "@/components/landing/FeaturedEvents";
import EntrAnywhereSection from "@/components/landing/EntrAnywhereSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main>
        <HeroSection />
        <ValueProposition />
        <FeaturesSection />
        <FeaturedEvents />
        <EntrAnywhereSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
