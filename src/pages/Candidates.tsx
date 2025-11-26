import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { NewCandidateDialog } from "@/components/NewCandidateDialog";
import { CandidateCard } from "@/components/CandidateCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";
import { toast } from "sonner";

interface Application {
  id: string;
  role: string;
  status: string;
  application_date: string;
  deadline?: string;
  next_step?: string;
  source?: string;
  team_id?: string;
  notes?: string;
}

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  notes?: string;
  created_at: string;
  first_viewed_at?: string | null;
}

interface CandidateWithApplications {
  candidate: Candidate;
  applications: Application[];
}

const Candidates = () => {
  const [candidatesWithApps, setCandidatesWithApps] = useState<CandidateWithApplications[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewCandidateDialog, setShowNewCandidateDialog] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);

  useEffect(() => {
    fetchCandidates();
    fetchTeams();

    // Set up realtime subscription for new candidates
    const channel = supabase
      .channel('candidates-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'candidates'
        },
        (payload) => {
          console.log('New candidate received:', payload);
          // Show toast notification
          toast.success(`Ny kandidat modtaget: ${payload.new.first_name} ${payload.new.last_name}`);
          // Refresh candidates list when new candidate is added
          fetchCandidates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("name");

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error("Error fetching teams:", error);
    }
  };

  const fetchCandidates = async () => {
    try {
      const { data: candidatesData, error: candidatesError } = await supabase
        .from("candidates")
        .select("*")
        .order("created_at", { ascending: false });

      if (candidatesError) throw candidatesError;

      const candidatesWithApplications = await Promise.all(
        (candidatesData || []).map(async (candidate) => {
          const { data: applications, error: appsError } = await supabase
            .from("applications")
            .select("id, role, status, application_date, deadline, next_step, source, team_id, notes")
            .eq("candidate_id", candidate.id)
            .order("application_date", { ascending: false });

          if (appsError) throw appsError;

          return {
            candidate,
            applications: applications || [],
          };
        })
      );

      setCandidatesWithApps(candidatesWithApplications);
    } catch (error: any) {
      toast.error("Kunne ikke hente kandidater");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCandidates = candidatesWithApps.filter(({ candidate }) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      candidate.first_name.toLowerCase().includes(searchLower) ||
      candidate.last_name.toLowerCase().includes(searchLower) ||
      candidate.email.toLowerCase().includes(searchLower) ||
      candidate.phone.includes(searchTerm)
    );
  });

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p>Indlæser kandidater...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-auto md:pt-0 pt-16">
        <div className="p-4 md:p-8">
          <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">Kandidater</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                {candidatesWithApps.length} kandidater · {candidatesWithApps.reduce((sum, item) => sum + item.applications.length, 0)} ansøgninger
              </p>
            </div>
            <Button onClick={() => setShowNewCandidateDialog(true)} className="w-full md:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Tilføj kandidat
            </Button>
          </div>

          <NewCandidateDialog
            open={showNewCandidateDialog}
            onOpenChange={setShowNewCandidateDialog}
            onSuccess={fetchCandidates}
          />

          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg efter navn, email eller telefon..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid gap-3">
            {filteredCandidates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Ingen kandidater fundet</p>
              </div>
            ) : (
              filteredCandidates.map(({ candidate, applications }) => (
                <CandidateCard 
                  key={candidate.id}
                  candidate={candidate}
                  applications={applications}
                  teams={teams}
                  onUpdate={fetchCandidates}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Candidates;
