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
}

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  notes?: string;
  created_at: string;
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

  useEffect(() => {
    fetchCandidates();
  }, []);

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
            .select("id, role, status, application_date, deadline, next_step, source")
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
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Kandidater</h1>
              <p className="text-muted-foreground">
                {candidatesWithApps.length} kandidater · {candidatesWithApps.reduce((sum, item) => sum + item.applications.length, 0)} ansøgninger
              </p>
            </div>
            <Button onClick={() => setShowNewCandidateDialog(true)}>
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
