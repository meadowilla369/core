import { CalendarPlus } from "lucide-react";
import { Link, BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { CheckinPage } from "@/pages/CheckinPage";
import { DisputesPage } from "@/pages/DisputesPage";
import { EventCreatePage } from "@/pages/EventCreatePage";
import { EventReviewPage } from "@/pages/EventReviewPage";
import { EventsPage } from "@/pages/EventsPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { RefundsPage } from "@/pages/RefundsPage";
import { ScannerPage } from "@/pages/ScannerPage";
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
  "/events/new": {
    title: "Create Event",
    description: "Build a draft event with attendee-facing details and ticket tiers."
  },
  "/events/edit": {
    title: "Edit Event",
    description: "Update a draft event before review."
  },
  "/inventory": {
    title: "Ticket Inventory",
    description: "Track sold, locked, and available inventory by event."
  },
  "/check-in": {
    title: "Live Check-In",
    description: "Watch gate health, duplicate scans, invalid scans, and sync jobs."
  },
  "/scanner": {
    title: "Gate Scanner",
    description: "Use device camera to scan attendee QR codes at the gate."
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
  const meta = location.pathname.match(/^\/events\/[^/]+\/review$/)
    ? {
        title: "Review Event",
        description: "Validate attendee-facing details before submitting or publishing."
      }
    : location.pathname.match(/^\/events\/[^/]+\/edit$/)
      ? {
          title: "Edit Event",
          description: "Update a draft event before review."
        }
      : (pageMeta[location.pathname] ?? {
          title: "Organizer Portal",
          description: "Manage event operations for your organizer account."
        });

  const headerAction =
    location.pathname === "/events" ? (
      <Link
        to="/events/new"
        className="inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
      >
        <CalendarPlus className="h-4 w-4" />
        Create event
      </Link>
    ) : null;

  return (
    <AppShell title={meta.title} description={meta.description} action={headerAction}>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/new" element={<EventCreatePage />} />
        <Route path="/events/:eventId/edit" element={<EventCreatePage />} />
        <Route path="/events/:eventId/review" element={<EventReviewPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/check-in" element={<CheckinPage />} />
        <Route path="/scanner" element={<ScannerPage />} />
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
