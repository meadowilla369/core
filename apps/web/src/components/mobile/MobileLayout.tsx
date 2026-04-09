import { ReactNode } from "react";
import BottomNav from "./BottomNav";

interface MobileLayoutProps {
  children: ReactNode;
}

const MobileLayout = ({ children }: MobileLayoutProps) => {
  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <main className="relative">{children}</main>
      <BottomNav />
    </div>
  );
};

export default MobileLayout;
