import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { NewCandidateDialog } from "@/components/NewCandidateDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Mail, Phone, FileText, Calendar, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface CandidateWithStats {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  notes?: string;
  created_at: string;
  total_applications: number;
  latest_application_date?: string;
  latest_status?: string;
  latest_role?: string;
}

const Candidates = () => {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<CandidateWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewCandidateDialog, setShowNewCandidateDialog] = useState(false);

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      // Fetch all candidates
      const { data: candidatesData, error: candidatesError } = await supabase
        .from("candidates")
        .select("*")
        .order("created_at", { ascending: false });

      if (candidatesError) throw candidatesError;

      // Fetch application stats for each candidate
      const candidatesWithStats = await Promise.all(
        (candidatesData || []).map(async (candidate) => {
          const { data: applications, error: appsError } = await supabase
            .from("applications")
            .select("application_date, status, role")
            .eq("candidate_id", candidate.id)
            .order("application_date", { ascending: false });

          if (appsError) throw appsError;

          const latest = applications?.[0];

          return {
            ...candidate,
            total_applications: applications?.length || 0,
            latest_application_date: latest?.application_date,
            latest_status: latest?.status,
            latest_role: latest?.role,
          };
        })
      );

      setCandidates(candidatesWithStats);
    } catch (error: any) {
      toast.error("Kunne ikke hente kandidater");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCandidates = candidates.filter((candidate) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      candidate.first_name.toLowerCase().includes(searchLower) ||
      candidate.last_name.toLowerCase().includes(searchLower) ||
      candidate.email.toLowerCase().includes(searchLower) ||
      candidate.phone.includes(searchTerm)
    );
  });

  const statusLabels: Record<string, string> = {
    ny: "Ny",
    telefon_screening: "Telefon-screening",
    case_rollespil: "Case/Rollespil",
    interview: "Interview",
    tilbud: "Tilbud",
    ansat: "Ansat",
    afslag: "Afslag",
    ghosted_cold: "Ghosted/Cold",
  };

  const roleLabels: Record<string, string> = {
    fieldmarketing: "Fieldmarketing",
    salgskonsulent: "Salgskonsulent",
  };

  const statusColors: Record<string, string> = {
    ny: "bg-status-new/10 text-status-new border-status-new/20",
    telefon_screening: "bg-status-progress/10 text-status-progress border-status-progress/20",
    case_rollespil: "bg-status-progress/10 text-status-progress border-status-progress/20",
    interview: "bg-status-progress/10 text-status-progress border-status-progress/20",
    tilbud: "bg-status-success/10 text-status-success border-status-success/20",
    ansat: "bg-status-success/10 text-status-success border-status-success/20",
    afslag: "bg-status-rejected/10 text-status-rejected border-status-rejected/20",
    ghosted_cold: "bg-muted text-muted-foreground border-border",
  };

  const roleColors: Record<string, string> = {
    fieldmarketing: "bg-role-fieldmarketing/10 text-role-fieldmarketing border-role-fieldmarketing/20",
    salgskonsulent: "bg-role-salgskonsulent/10 text-role-salgskonsulent border-role-salgskonsulent/20",
  };

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
                {candidates.length} unikke personer i systemet
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

          <div className="grid gap-4">
            {filteredCandidates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Ingen kandidater fundet</p>
              </div>
            ) : (
              filteredCandidates.map((candidate) => (
                <Card
                  key={candidate.id}
                  className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/50"
                  onClick={() => navigate(`/candidates/${candidate.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-xl">
                              {candidate.first_name} {candidate.last_name}
                            </h3>
                            <div className="flex flex-col gap-1 mt-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Mail className="h-3 w-3" />
                                <span>{candidate.email}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="h-3 w-3" />
                                <span>{candidate.phone}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <Badge variant="outline" className="mb-2">
                              <FileText className="h-3 w-3 mr-1" />
                              {candidate.total_applications} ansøgning{candidate.total_applications !== 1 ? "er" : ""}
                            </Badge>
                            {candidate.total_applications > 1 && (
                              <div className="text-xs text-amber-600 font-medium">
                                Har søgt {candidate.total_applications} gange
                              </div>
                            )}
                          </div>
                        </div>

                        {candidate.latest_application_date && (
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                            <span className="text-sm text-muted-foreground">Seneste ansøgning:</span>
                            {candidate.latest_role && (
                              <Badge className={roleColors[candidate.latest_role]}>
                                {roleLabels[candidate.latest_role]}
                              </Badge>
                            )}
                            {candidate.latest_status && (
                              <Badge className={statusColors[candidate.latest_status]}>
                                {statusLabels[candidate.latest_status]}
                              </Badge>
                            )}
                            <div className="flex items-center gap-1 text-sm text-muted-foreground ml-auto">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {format(new Date(candidate.latest_application_date), "d. MMM yyyy", { locale: da })}
                              </span>
                            </div>
                          </div>
                        )}

                        {candidate.notes && (
                          <div className="text-sm bg-muted/50 rounded p-2">
                            <span className="font-medium">Note:</span> {candidate.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Candidates;
