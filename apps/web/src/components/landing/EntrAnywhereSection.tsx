import { useEffect, useRef } from "react";
import { GlowOnView } from "@/hooks/useGlowOnView";

const categories = {
  row1: [
    "Concerts",
    "Sports",
    "Musicals",
    "Festivals",
    "Comedy Shows",
    "Concerts",
    "Sports",
    "Musicals",
    "Festivals",
    "Comedy Shows"
  ],
  row2: [
    "Theater",
    "Conferences",
    "Exhibitions",
    "Club Nights",
    "Operas",
    "Theater",
    "Conferences",
    "Exhibitions",
    "Club Nights",
    "Operas"
  ],
  row3: [
    "Stand-up",
    "E-Sports",
    "Film Premieres",
    "Award Shows",
    "Galas",
    "Stand-up",
    "E-Sports",
    "Film Premieres",
    "Award Shows",
    "Galas"
  ],
  row4: [
    "Food Festivals",
    "Art Shows",
    "Dance Events",
    "Charity Events",
    "Pop-ups",
    "Food Festivals",
    "Art Shows",
    "Dance Events",
    "Charity Events",
    "Pop-ups"
  ]
};

const MarqueeRow = ({
  items,
  direction = "left",
  speed = 30
}: {
  items: string[];
  direction?: "left" | "right";
  speed?: number;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let animationId: number;
    let position = direction === "left" ? 0 : -scrollContainer.scrollWidth / 2;
    const step = speed / 60;

    const animate = () => {
      if (direction === "left") {
        position -= step;
        if (position <= -scrollContainer.scrollWidth / 2) position = 0;
      } else {
        position += step;
        if (position >= 0) position = -scrollContainer.scrollWidth / 2;
      }

      scrollContainer.style.transform = `translateX(${position}px)`;
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [direction, speed]);

  return (
    <div className="relative overflow-hidden">
      {/* edge fades (n1-style) */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent" />

      <div
        ref={scrollRef}
        className="flex gap-10 whitespace-nowrap py-2 will-change-transform md:gap-12"
      >
        {items.map((item, index) => (
          <span
            key={index}
            className="select-none font-sans text-5xl font-medium uppercase leading-none tracking-[-0.04em] text-foreground/20 transition-colors hover:text-foreground md:text-7xl lg:text-8xl"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};

const EntrAnywhereSection = () => {
  return (
    <section className="py-24 md:py-32 bg-background overflow-hidden border-y border-border">
      <div className="container mx-auto px-4 md:px-6 mb-16">
        <GlowOnView>
          <h2 className="text-5xl md:text-7xl lg:text-8xl font-medium uppercase tracking-[-0.06em] leading-[0.9] text-foreground">
            Entr Anywhere
          </h2>
        </GlowOnView>
        <GlowOnView delay={200}>
          <p className="mt-6 max-w-2xl font-mono text-base md:text-lg uppercase tracking-[0.18em] text-foreground/60">
            From stadium tours to intimate venues, your ticket to every experience.
          </p>
        </GlowOnView>
      </div>

      <div className="space-y-0">
        <MarqueeRow items={categories.row1} direction="left" speed={22} />
        <MarqueeRow items={categories.row2} direction="right" speed={22} />
        <MarqueeRow items={categories.row3} direction="left" speed={22} />
        <MarqueeRow items={categories.row4} direction="right" speed={22} />
      </div>
    </section>
  );
};

export default EntrAnywhereSection;
