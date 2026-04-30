import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { OverviewPage } from "@/pages/OverviewPage";

const pageMeta: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Operations Overview",
    description: "All organizer events, risk queues, and live operational health."
  }
};

function RoutedApp() {
  const meta = pageMeta[window.location.pathname] ?? {
    title: "Organizer Portal",
    description: "Manage event operations for your organizer account."
  };

  return (
    <AppShell title={meta.title} description={meta.description}>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
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
