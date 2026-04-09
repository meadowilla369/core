import { ArrowUpRight } from "lucide-react";
import { GlowOnView } from "@/hooks/useGlowOnView";

const events = [
  { id: "01", name: "CYBER SYMPHONY 2025", date: "MAR 15", location: "TOKYO" },
  { id: "02", name: "NEON NIGHTS FESTIVAL", date: "APR 22-24", location: "LAS VEGAS" },
  { id: "03", name: "DIGITAL HORIZONS", date: "MAY 10", location: "BERLIN" }
];

const FeaturedEvents = () => {
  return (
    <section className="border-t border-foreground">
      {/* Section header */}
      <div className="p-6 md:p-10 border-b border-foreground flex items-center justify-between">
        <span className="font-mono text-xs tracking-widest">[ UPCOMING EVENTS ]</span>
        <a
          href="#"
          className="font-mono text-xs tracking-widest hover:opacity-60 transition-opacity flex items-center gap-2"
        >
          VIEW ALL <ArrowUpRight className="w-3 h-3" />
        </a>
      </div>

      {/* Events list */}
      <div className="divide-y divide-foreground">
        {events.map((event, i) => (
          <GlowOnView key={event.id} delay={i * 150}>
            <a
              href="#"
              className="flex items-center p-6 md:p-10 group hover:bg-foreground hover:text-background transition-colors"
            >
              <span className="font-mono text-xs tracking-wider opacity-40 w-12">{event.id}</span>
              <div className="flex-1">
                <h3 className="text-2xl md:text-4xl lg:text-5xl font-medium tracking-tight group-hover:translate-x-4 transition-transform">
                  {event.name}
                </h3>
              </div>
              <div className="hidden md:flex items-center gap-8 font-mono text-xs tracking-wider opacity-60 group-hover:opacity-100">
                <span>{event.date}</span>
                <span>{event.location}</span>
              </div>
              <ArrowUpRight className="w-6 h-6 ml-6 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          </GlowOnView>
        ))}
      </div>
    </section>
  );
};

export default FeaturedEvents;
