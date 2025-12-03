import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { useSmsNotifications } from "@/hooks/useSmsNotifications";
import { SoftphoneProvider, useSoftphone } from "@/contexts/SoftphoneContext";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { Softphone } from "@/components/Softphone";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Candidates from "./pages/Candidates";
import CandidateProfile from "./pages/CandidateProfile";
import Employees from "./pages/Employees";
import Messages from "./pages/Messages";
import Reports from "./pages/Reports";
import UpcomingHires from "./pages/UpcomingHires";
import UpcomingInterviews from "./pages/UpcomingInterviews";
import Winback from "./pages/Winback";
import Admin from "./pages/Admin";
import SmsTemplates from "./pages/SmsTemplates";
import EmailTemplates from "./pages/EmailTemplates";
import Teams from "./pages/Teams";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Global softphone UI component
const GlobalSoftphone = ({ userId }: { userId: string }) => {
  const { isOpen, openSoftphone, closeSoftphone, initialPhoneNumber, twilioManager } = useSoftphone();

  if (!twilioManager) return null;

  return (
    <>
      {!isOpen && (
        <Button
          onClick={() => openSoftphone()}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
          size="icon"
        >
          <Phone className="h-6 w-6" />
        </Button>
      )}

      {isOpen && (
        <Softphone
          userId={userId}
          onClose={closeSoftphone}
          initialPhoneNumber={initialPhoneNumber}
          twilioManager={twilioManager}
        />
      )}
    </>
  );
};

// Inner component that uses hooks requiring session
const AppContent = ({ session }: { session: Session }) => {
  // Enable SMS notifications
  useSmsNotifications();

  return (
    <SoftphoneProvider userId={session.user.id}>
      <Routes>
        <Route path="/auth" element={<Navigate to="/" replace />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/candidates" element={<Candidates />} />
        <Route path="/candidates/:id" element={<CandidateProfile />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/upcoming-hires" element={<UpcomingHires />} />
        <Route path="/upcoming-interviews" element={<UpcomingInterviews />} />
        <Route path="/winback" element={<Winback />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/sms-templates" element={<SmsTemplates />} />
        <Route path="/email-templates" element={<EmailTemplates />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="*" element={<NotFound />} />
      </Routes>

      <GlobalSoftphone userId={session.user.id} />
    </SoftphoneProvider>
  );
};

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Indlæser...</p>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {session ? (
            <AppContent session={session} />
          ) : (
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="*" element={<Navigate to="/auth" replace />} />
            </Routes>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
