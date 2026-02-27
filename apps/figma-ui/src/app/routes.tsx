import { createBrowserRouter } from "react-router";
import { Home } from "./pages/Home";
import { BuyerExplore } from "./pages/buyer/Explore";
import { EventDetail } from "./pages/buyer/EventDetail";
import { Checkout } from "./pages/buyer/Checkout";
import { TicketDetail } from "./pages/buyer/TicketDetail";
import { ResaleCreate } from "./pages/buyer/ResaleCreate";
import { KYCStepper } from "./pages/buyer/KYCStepper";
import { MyTickets } from "./pages/buyer/MyTickets";
import { BuyerProfile } from "./pages/buyer/Profile";
import { StaffScan } from "./pages/staff/Scan";
import { ScanResult } from "./pages/staff/ScanResult";
import { StaffDashboard } from "./pages/staff/Dashboard";
import { OrganizerDashboard } from "./pages/organizer/Dashboard";
import { OrganizerEventManagement } from "./pages/organizer/EventManagement";
import { OrganizerEventDetail } from "./pages/organizer/EventDetail";
import { OrganizerEventEditor } from "./pages/organizer/EventEditor";
import { DisputeQueue } from "./pages/platform/DisputeQueue";
import { DisputeDetail } from "./pages/platform/DisputeDetail";
import { PlatformAnalytics } from "./pages/platform/Analytics";
import { PlatformUserManagement } from "./pages/platform/UserManagement";
import { NotFound } from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  // Buyer/Seller Routes
  {
    path: "/explore",
    Component: BuyerExplore,
  },
  {
    path: "/event/:eventId",
    Component: EventDetail,
  },
  {
    path: "/checkout/:eventId",
    Component: Checkout,
  },
  {
    path: "/tickets",
    Component: MyTickets,
  },
  {
    path: "/ticket/:ticketId",
    Component: TicketDetail,
  },
  {
    path: "/resale/create/:ticketId",
    Component: ResaleCreate,
  },
  {
    path: "/kyc",
    Component: KYCStepper,
  },
  {
    path: "/profile",
    Component: BuyerProfile,
  },
  // Staff Routes
  {
    path: "/staff/dashboard",
    Component: StaffDashboard,
  },
  {
    path: "/staff/scan",
    Component: StaffScan,
  },
  {
    path: "/staff/scan-result",
    Component: ScanResult,
  },
  // Organizer Routes
  {
    path: "/organizer/dashboard",
    Component: OrganizerDashboard,
  },
  {
    path: "/organizer/events",
    Component: OrganizerEventManagement,
  },
  {
    path: "/organizer/event/new",
    Component: OrganizerEventEditor,
  },
  {
    path: "/organizer/event/:eventId",
    Component: OrganizerEventDetail,
  },
  {
    path: "/organizer/event/:eventId/edit",
    Component: OrganizerEventEditor,
  },
  // Platform Admin Routes
  {
    path: "/platform/analytics",
    Component: PlatformAnalytics,
  },
  {
    path: "/platform/users",
    Component: PlatformUserManagement,
  },
  {
    path: "/platform/disputes",
    Component: DisputeQueue,
  },
  {
    path: "/platform/dispute/:disputeId",
    Component: DisputeDetail,
  },
  // 404
  {
    path: "*",
    Component: NotFound,
  },
]);
