import { GlowOnView } from "@/hooks/useGlowOnView";

const ValueProposition = () => {
  return (
    <section className="border-t border-foreground">
      {/* Stats row */}
      <div className="grid grid-cols-3 border-b border-foreground">
        <GlowOnView className="p-6 md:p-10 border-r border-foreground" delay={100}>
          <p className="text-4xl md:text-6xl lg:text-7xl font-medium tracking-tight">100K+</p>
          <p className="font-mono text-[10px] md:text-xs tracking-wider mt-2 opacity-60">
            TPS CAPACITY
          </p>
        </GlowOnView>
        <GlowOnView className="p-6 md:p-10 border-r border-foreground" delay={200}>
          <p className="text-4xl md:text-6xl lg:text-7xl font-medium tracking-tight">&lt;1MS</p>
          <p className="font-mono text-[10px] md:text-xs tracking-wider mt-2 opacity-60">LATENCY</p>
        </GlowOnView>
        <GlowOnView className="p-6 md:p-10" delay={300}>
          <p className="text-4xl md:text-6xl lg:text-7xl font-medium tracking-tight">0%</p>
          <p className="font-mono text-[10px] md:text-xs tracking-wider mt-2 opacity-60">
            SCALPERS
          </p>
        </GlowOnView>
      </div>

      {/* Main statement */}
      <GlowOnView className="p-6 md:p-10 lg:p-16">
        <p className="text-2xl md:text-4xl lg:text-5xl font-medium leading-tight tracking-tight max-w-5xl">
          A ticketing protocol that rivals
          <br />
          <span className="opacity-40">traditional centralized systems.</span>
        </p>
      </GlowOnView>

      {/* Feature grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 border-t border-foreground">
        {[
          {
            num: "01",
            title: "FAIR QUEUING",
            desc: "Blockchain-verified queue position. No bots, no scalpers."
          },
          {
            num: "02",
            title: "ZERO CRASHES",
            desc: "Infinite scalability. Handle any demand without downtime."
          },
          {
            num: "03",
            title: "P2P RESALE",
            desc: "Smart contract-enforced price caps protect fans."
          },
          {
            num: "04",
            title: "TRUE OWNERSHIP",
            desc: "Your ticket is an NFT you control completely."
          }
        ].map((item, i) => (
          <GlowOnView
            key={item.num}
            delay={i * 100}
            className={`p-6 md:p-8 ${i < 3 ? "border-r border-foreground" : ""} border-b md:border-b-0 border-foreground group hover:bg-foreground hover:text-background transition-colors cursor-default`}
          >
            <span className="font-mono text-xs tracking-wider opacity-40 group-hover:opacity-60">
              {item.num}
            </span>
            <h3 className="text-lg md:text-xl font-medium mt-4 mb-2">{item.title}</h3>
            <p className="font-mono text-xs leading-relaxed opacity-60 group-hover:opacity-80">
              {item.desc}
            </p>
          </GlowOnView>
        ))}
      </div>
    </section>
  );
};

export default ValueProposition;
