import { useEffect, useRef, useState, forwardRef } from "react";

export const useGlowOnView = (threshold = 0.6, delay = 800) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isGlowing, setIsGlowing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timeoutRef.current = setTimeout(() => {
            setIsGlowing(true);
          }, delay);
        } else {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          setIsGlowing(false);
        }
      },
      { threshold }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [threshold, delay]);

  return { ref, isGlowing };
};

interface GlowOnViewProps {
  children: React.ReactNode;
  className?: string;
  threshold?: number;
  delay?: number;
}

export const GlowOnView = ({
  children,
  className = "",
  threshold = 0.5,
  delay = 300
}: GlowOnViewProps) => {
  const { ref, isGlowing } = useGlowOnView(threshold, delay);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${isGlowing ? "text-glow" : ""} ${className}`}
    >
      {children}
    </div>
  );
};
