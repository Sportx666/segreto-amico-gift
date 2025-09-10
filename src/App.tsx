import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { ConsentBanner } from "@/components/ConsentBanner";
import { AdSlot } from "@/components/AdSlot";
import { useAdsConsent } from "@/hooks/useAdsConsent";
import { getAdSlotsForRoute } from "@/lib/adsConfig";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Events from "./pages/Events";
import EventNew from "./pages/EventNew";
import EventDetail from "./pages/EventDetail";
import EventJoin from "./pages/EventJoin";
import NotFound from "./pages/NotFound";
import Ideas from "./pages/Ideas";
import Wishlist from "./pages/Wishlist";
import Privacy from "./pages/Privacy";
import Cookies from "./pages/Cookies";
import Terms from "./pages/Terms";
import Profile from "./pages/Profile";
import { Footer } from "@/components/Footer";

const queryClient = new QueryClient();

const AppContent = () => {
  const location = useLocation();
  const { hasConsent, showBanner, acceptConsent, rejectConsent } = useAdsConsent();
  const adSlots = getAdSlotsForRoute(location.pathname);

  const showEdgeAds = adSlots.includes("edge-left") || adSlots.includes("edge-right");
  const showMobileFeed = adSlots.includes("mobile-feed");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className={`flex ${showEdgeAds ? 'lg:gap-8' : ''}`}>
        {/* Left Edge Ad */}
        {adSlots.includes("edge-left") && (
          <div className="hidden lg:block w-40 xl:w-48 flex-shrink-0">
            <div className="sticky top-20 p-4">
              <AdSlot id="edge-left" />
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <Routes>
            <Route path="/" element={<Index showMobileFeed={showMobileFeed} />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/events" element={<Events showMobileFeed={showMobileFeed} />} />
            <Route path="/events/new" element={<EventNew />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/join/:token" element={<EventJoin />} />
            <Route path="/ideas" element={<Ideas showMobileFeed={showMobileFeed} />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/cookies" element={<Cookies />} />
            <Route path="/terms" element={<Terms />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>

        {/* Right Edge Ad */}
        {adSlots.includes("edge-right") && (
          <div className="hidden lg:block w-40 xl:w-48 flex-shrink-0">
            <div className="sticky top-20 p-4">
              <AdSlot id="edge-right" />
            </div>
          </div>
        )}
      </div>

      <Footer />
      
      {/* Consent Banner */}
      {showBanner && (
        <ConsentBanner onAccept={acceptConsent} onReject={rejectConsent} />
      )}
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
