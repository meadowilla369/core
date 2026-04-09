import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "@ticket-platform/shared-ui";
import { GlowOnView } from "@/hooks/useGlowOnView";

const CTASection = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    setTimeout(() => {
      toast({
        title: "You're on the list!",
        description: "We'll notify you when Entr launches."
      });
      setEmail("");
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <section className="border-t border-foreground">
      <div className="p-6 md:p-10 lg:p-16">
        {/* Big CTA text */}
        <GlowOnView>
          <h2 className="text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight mb-8">
            JOIN THE
            <br />
            WAITLIST
          </h2>
        </GlowOnView>

        <p className="font-mono text-sm max-w-md mb-10 opacity-60">
          Get early access when we launch. No spam, just updates that matter.
        </p>

        {/* Email form */}
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-0 max-w-xl">
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 px-6 py-4 bg-transparent border border-foreground font-mono text-sm placeholder:opacity-40 focus:outline-none focus:bg-foreground/[0.03]"
            required
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-4 bg-foreground text-background font-mono text-sm tracking-widest hover:opacity-80 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? "..." : "SUBSCRIBE"}
            {!isSubmitting && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </section>
  );
};

export default CTASection;
