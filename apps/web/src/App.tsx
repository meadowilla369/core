import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProviders } from "./providers/AppProviders";
import HomePage from "./pages/HomePage";
import DiscoverPage from "./pages/DiscoverPage";
import TicketsPage from "./pages/TicketsPage";
import TicketDetailPage from "./pages/TicketDetailPage";
import ProfilePage from "./pages/ProfilePage";
import EventDetailPage from "./pages/EventDetailPage";
import OnboardingPage from "./pages/OnboardingPage";
import PrimaryPurchasePage from "./pages/PrimaryPurchasePage";
import MarketplacePage from "./pages/MarketplacePage";
import ResalePurchasePage from "./pages/ResalePurchasePage";
import ResaleSalePage from "./pages/ResaleSalePage";
import TradePage from "./pages/TradePage";
import SellerTransactionPage from "./pages/SellerTransactionPage";
import BuyerTransactionPage from "./pages/BuyerTransactionPage";
import TradeTransactionPage from "./pages/TradeTransactionPage";
import NotFound from "./pages/NotFound";
import NativeDeepLinkListener from "./components/NativeDeepLinkListener";

const App = () => (
  <AppProviders>
    <BrowserRouter>
      <NativeDeepLinkListener />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/ticket/:id" element={<TicketDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/event/:id" element={<EventDetailPage />} />
        <Route path="/event/:id/purchase" element={<PrimaryPurchasePage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/marketplace/buy/:ticketId" element={<ResalePurchasePage />} />
        <Route path="/marketplace/sell" element={<ResaleSalePage />} />
        <Route path="/marketplace/trade" element={<TradePage />} />
        <Route path="/marketplace/transaction/sell" element={<SellerTransactionPage />} />
        <Route path="/marketplace/transaction/buy" element={<BuyerTransactionPage />} />
        <Route path="/marketplace/transaction/trade" element={<TradeTransactionPage />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </AppProviders>
);

export default App;
