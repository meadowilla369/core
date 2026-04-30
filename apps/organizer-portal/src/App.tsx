import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { CheckinPage } from "@/pages/CheckinPage";
import { DisputesPage } from "@/pages/DisputesPage";
import { EventsPage } from "@/pages/EventsPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { RefundsPage } from "@/pages/RefundsPage";
import { SettlementPage } from "@/pages/SettlementPage";
import { SystemHealthPage } from "@/pages/SystemHealthPage";

const pageMeta: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Operations Overview",
    description: "All organizer events, risk queues, and live operational health."
  },
  "/events": {
    title: "Events",
    description: "Create, edit, cancel, and monitor organizer-owned events."
  },
  "/inventory": {
    title: "Ticket Inventory",
    description: "Track sold, locked, and available inventory by event."
  },
  "/check-in": {
    title: "Live Check-In",
    description: "Watch gate health, duplicate scans, invalid scans, and sync jobs."
  },
  "/refunds": {
    title: "Refunds",
    description: "Monitor refund requests, payout retries, and cancellation impact."
  },
  "/disputes": {
    title: "Disputes",
    description: "Review SLA-driven support and moderation cases."
  },
  "/settlement": {
    title: "Settlement",
    description: "Review revenue, resale royalties, reconciliation, and payout readiness."
  },
  "/health": {
    title: "System Health",
    description: "Check product-level readiness across operational services."
  }
};

function RoutedApp() {
  const location = useLocation();
  const meta = pageMeta[location.pathname] ?? {
    title: "Organizer Portal",
    description: "Manage event operations for your organizer account."
  };

  return (
    <AppShell title={meta.title} description={meta.description}>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/check-in" element={<CheckinPage />} />
        <Route path="/refunds" element={<RefundsPage />} />
        <Route path="/disputes" element={<DisputesPage />} />
        <Route path="/settlement" element={<SettlementPage />} />
        <Route path="/health" element={<SystemHealthPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}

const App = () => (
  <BrowserRouter>
    <RoutedApp />
  </BrowserRouter>
);

export default App;
