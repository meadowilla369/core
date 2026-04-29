import { ReactNode } from "react";
import BottomNav from "./BottomNav";

interface MobileLayoutProps {
  children: ReactNode;
}

const MobileLayout = ({ children }: MobileLayoutProps) => {
  return (
    <div className="min-h-dvh bg-background text-foreground safe-area-x">
      <main className="relative min-h-dvh safe-area-top pb-[calc(var(--mobile-bottom-nav-height)+var(--safe-area-bottom-padding))]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
};

export default MobileLayout;
