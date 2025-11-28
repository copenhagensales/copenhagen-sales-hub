import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { useSmsNotifications } from "@/hooks/useSmsNotifications";
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
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSoftphoneOpen, setIsSoftphoneOpen] = useState(false);

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

  // Enable SMS notifications when user is logged in
  useSmsNotifications();

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
          <Routes>
            <Route
              path="/auth"
              element={session ? <Navigate to="/" replace /> : <Auth />}
            />
            <Route
              path="/"
              element={session ? <Dashboard /> : <Navigate to="/auth" replace />}
            />
            <Route
              path="/candidates"
              element={session ? <Candidates /> : <Navigate to="/auth" replace />}
            />
            <Route
              path="/candidates/:id"
              element={session ? <CandidateProfile /> : <Navigate to="/auth" replace />}
            />
            <Route
              path="/employees"
              element={session ? <Employees /> : <Navigate to="/auth" replace />}
            />
            <Route
              path="/messages"
              element={session ? <Messages /> : <Navigate to="/auth" replace />}
            />
            <Route
              path="/upcoming-hires"
              element={session ? <UpcomingHires /> : <Navigate to="/auth" replace />}
            />
            <Route
              path="/pipeline"
              element={session ? <Dashboard /> : <Navigate to="/auth" replace />}
            />
            <Route
              path="/reports"
              element={session ? <Reports /> : <Navigate to="/auth" replace />}
            />
            <Route
              path="/admin"
              element={session ? <Admin /> : <Navigate to="/auth" replace />}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
          
          {/* Global Softphone - only show when logged in */}
          {session && (
            <>
              {!isSoftphoneOpen && (
                <Button
                  onClick={() => setIsSoftphoneOpen(true)}
                  className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
                  size="icon"
                >
                  <Phone className="h-6 w-6" />
                </Button>
              )}
              
              {isSoftphoneOpen && (
                <Softphone
                  userId={session.user.id}
                  onClose={() => setIsSoftphoneOpen(false)}
                />
              )}
            </>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
