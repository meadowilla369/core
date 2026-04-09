const HeroBlob = () => {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Main glowing blob - Moonlight White/Lavender glow */}
      <div
        className="absolute w-[80%] max-w-[600px] aspect-square animate-float-slow"
        style={{
          background: `
            radial-gradient(ellipse 100% 100% at 50% 100%, 
              hsl(300 8% 85%) 0%,
              hsl(300 5% 75%) 20%,
              hsl(300 3% 65% / 0.8) 40%,
              hsl(300 2% 50% / 0.4) 60%,
              transparent 80%
            )
          `,
          filter: "blur(2px)",
          transform: "scaleY(0.7)"
        }}
      />

      {/* Inner bright glow layer */}
      <div
        className="absolute w-[60%] max-w-[450px] aspect-square animate-pulse-glow"
        style={{
          background: `
            radial-gradient(ellipse 80% 80% at 50% 80%, 
              hsl(300 10% 95%) 0%,
              hsl(300 5% 83% / 0.6) 40%,
              transparent 70%
            )
          `,
          transform: "scaleY(0.6)"
        }}
      />

      {/* Highlight streak */}
      <div
        className="absolute w-[40%] max-w-[300px] h-1 opacity-40"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(300 5% 90%) 50%, transparent 100%)",
          top: "35%"
        }}
      />
    </div>
  );
};

export default HeroBlob;
