import HeroBlob from "./HeroBlob";
import { GlowOnView } from "@/hooks/useGlowOnView";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Minimal Nav */}
      <nav className="absolute top-0 left-0 right-0 z-50 px-6 md:px-10 py-6 flex items-center justify-between">
        <div className="text-xl font-medium tracking-tight">E/</div>
        <button className="font-mono text-xs tracking-widest border border-foreground px-4 py-2 hover:bg-foreground hover:text-background transition-colors">
          MENU
        </button>
      </nav>

      {/* Hero Blob - Top */}
      <div className="h-[45vh] min-h-[300px] relative">
        <HeroBlob />
      </div>

      {/* Giant Typography */}
      <div className="px-4 md:px-6 pb-12">
        <GlowOnView delay={200}>
          <h1 className="text-mega leading-[0.8] tracking-[-0.05em]">ALL TICKETS</h1>
        </GlowOnView>

        <GlowOnView delay={400}>
          <div className="flex items-center gap-4 md:gap-6">
            <div className="w-20 h-20 md:w-32 md:h-32 bg-gradient-to-br from-accent to-accent/70 flex-shrink-0" />
            <h1 className="text-mega leading-[0.8] tracking-[-0.05em]">ALL EVENTS</h1>
          </div>
        </GlowOnView>

        <GlowOnView delay={600}>
          <h1 className="text-mega leading-[0.8] tracking-[-0.05em] text-right">ONE CHAIN</h1>
        </GlowOnView>

        {/* Subtitle row */}
        <div className="mt-8 md:mt-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs tracking-wider opacity-60">⚡ FAIR QUEUING</span>
            <span className="font-mono text-xs tracking-wider opacity-60">⚡ NO CRASHES</span>
            <span className="font-mono text-xs tracking-wider opacity-60">⚡ P2P RESALE</span>
          </div>

          <div className="max-w-sm">
            <p className="font-mono text-sm leading-relaxed">
              ENTR IS A BLOCKCHAIN-BASED TICKETING PLATFORM
              <br />
              <span className="font-medium">BUILDING THE FUTURE OF LIVE EVENTS</span>
            </p>
            <a
              href="#"
              className="inline-flex items-center gap-2 mt-4 font-mono text-xs tracking-widest border-b border-foreground pb-1 hover:opacity-60 transition-opacity"
            >
              [ ⊕ READ MORE ]
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
