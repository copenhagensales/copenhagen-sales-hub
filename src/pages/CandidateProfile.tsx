import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { NewApplicationDialog } from "@/components/NewApplicationDialog";
import { EditCandidateDialog } from "@/components/EditCandidateDialog";
import { Softphone } from "@/components/Softphone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  FileText,
  MessageSquare,
  PhoneCall,
  TrendingUp,
  AlertCircle,
  Plus,
  Edit,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  notes?: string;
  created_at: string;
}

interface Application {
  id: string;
  role: string;
  status: string;
  source?: string;
  application_date: string;
  deadline?: string;
  next_step?: string;
  notes?: string;
  rejection_reason?: string;
  team_id?: string;
  hired_date?: string;
  employment_ended_date?: string;
  employment_end_reason?: string;
}

interface Communication {
  id: string;
  type: string;
  direction: string;
  content?: string;
  outcome?: string;
  duration?: number;
  created_at: string;
  application: {
    role: string;
    application_date: string;
  };
}

interface PerformanceReview {
  id: string;
  review_period: number;
  rating: string;
  comments?: string;
  review_date: string;
  application: {
    role: string;
  };
}

const CandidateProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [performanceReviews, setPerformanceReviews] = useState<PerformanceReview[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewApplicationDialog, setShowNewApplicationDialog] = useState(false);
  const [showEditCandidateDialog, setShowEditCandidateDialog] = useState(false);
  const [showSoftphone, setShowSoftphone] = useState(false);
  const [softphoneInitialNumber, setSoftphoneInitialNumber] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [showHiredDateDialog, setShowHiredDateDialog] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ applicationId: string; newStatus: string } | null>(null);
  const [hiredDate, setHiredDate] = useState<string>('');

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getCurrentUser();

    if (id) {
      fetchCandidateData();
    }
  }, [id]);

  const fetchCandidateData = async () => {
    try {
      // Fetch candidate
      const { data: candidateData, error: candidateError } = await supabase
        .from("candidates")
        .select("*")
        .eq("id", id)
        .single();

      if (candidateError) throw candidateError;
      setCandidate(candidateData);

      // Fetch teams
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("*")
        .order("name");

      if (teamsError) throw teamsError;
      setTeams(teamsData || []);

      // Fetch applications
      const { data: applicationsData, error: appsError } = await supabase
        .from("applications")
        .select("*")
        .eq("candidate_id", id)
        .order("application_date", { ascending: false });

      if (appsError) throw appsError;
      setApplications(applicationsData || []);

      // Fetch communications across all applications
      const applicationIds = applicationsData?.map((app) => app.id) || [];
      if (applicationIds.length > 0) {
        const { data: commsData, error: commsError } = await supabase
          .from("communication_logs")
          .select(`
            *,
            application:applications(role, application_date)
          `)
          .in("application_id", applicationIds)
          .order("created_at", { ascending: false });

        if (commsError) throw commsError;
        setCommunications(commsData || []);

        // Fetch performance reviews
        const { data: reviewsData, error: reviewsError } = await supabase
          .from("performance_reviews")
          .select(`
            *,
            application:applications(role)
          `)
          .in("application_id", applicationIds)
          .order("review_date", { ascending: false });

        if (reviewsError) throw reviewsError;
        setPerformanceReviews(reviewsData || []);
      }
    } catch (error: any) {
      toast.error("Kunne ikke hente kandidat data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

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

  const getRatingColor = (rating: string) => {
    if (rating === "green" || rating === "5" || rating === "4") return "text-status-success";
    if (rating === "yellow" || rating === "3") return "text-status-warning";
    return "text-status-rejected";
  };

  const handleStatusChange = async (applicationId: string, newStatus: string) => {
    try {
      // If changing to "ansat", check if team and hired_date are set
      if (newStatus === "ansat") {
        const application = applications.find(app => app.id === applicationId);
        if (!application?.team_id) {
          toast.error("Du skal vælge et team før du kan sætte status til Ansat");
          return;
        }
        
        // Check if hired_date is set, if not show dialog
        if (!application?.hired_date) {
          setPendingStatusChange({ applicationId, newStatus });
          setHiredDate(new Date().toISOString().split('T')[0]); // Default to today
          setShowHiredDateDialog(true);
          return;
        }
      }

      const { error } = await supabase
        .from("applications")
        .update({ status: newStatus as any })
        .eq("id", applicationId);

      if (error) throw error;

      toast.success("Status opdateret!");
      fetchCandidateData();
    } catch (error: any) {
      toast.error("Kunne ikke opdatere status");
      console.error(error);
    }
  };

  const handleConfirmHiredDate = async () => {
    if (!pendingStatusChange || !hiredDate) {
      toast.error("Ansættelsesdato er påkrævet");
      return;
    }

    try {
      const { error } = await supabase
        .from("applications")
        .update({ 
          status: pendingStatusChange.newStatus as any,
          hired_date: hiredDate
        })
        .eq("id", pendingStatusChange.applicationId);

      if (error) throw error;

      toast.success("Medarbejder markeret som ansat!");
      setShowHiredDateDialog(false);
      setPendingStatusChange(null);
      setHiredDate('');
      fetchCandidateData();
    } catch (error: any) {
      toast.error("Kunne ikke opdatere status");
      console.error(error);
    }
  };

  const handleRoleChange = async (applicationId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from("applications")
        .update({ role: newRole as any })
        .eq("id", applicationId);

      if (error) throw error;

      toast.success("Rolle opdateret!");
      fetchCandidateData();
    } catch (error: any) {
      toast.error("Kunne ikke opdatere rolle");
      console.error(error);
    }
  };

  const handleSourceChange = async (applicationId: string, newSource: string) => {
    try {
      const { error } = await supabase
        .from("applications")
        .update({ source: newSource || null })
        .eq("id", applicationId);

      if (error) throw error;

      toast.success("Kilde opdateret!");
      fetchCandidateData();
    } catch (error: any) {
      toast.error("Kunne ikke opdatere kilde");
      console.error(error);
    }
  };

  const handleTeamChange = async (applicationId: string, newTeamId: string) => {
    try {
      const { error } = await supabase
        .from("applications")
        .update({ team_id: newTeamId || null })
        .eq("id", applicationId);

      if (error) throw error;

      toast.success("Team opdateret!");
      fetchCandidateData();
    } catch (error: any) {
      toast.error("Kunne ikke opdatere team");
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p>Indlæser kandidat...</p>
        </div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Kandidat ikke fundet</p>
            <Button onClick={() => navigate("/candidates")}>Tilbage til kandidater</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate("/candidates")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Tilbage til kandidater
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowEditCandidateDialog(true)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Rediger kandidat
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(`mailto:${candidate.email}`)}
              >
                <Mail className="mr-2 h-4 w-4" />
                Send email
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const { data, error } = await supabase.functions.invoke('call-candidate', {
                      body: { candidatePhone: candidate.phone }
                    });
                    
                    if (error) throw error;
                    
                    toast.success("Twilio ringer dig op nu og forbinder til kandidaten");
                  } catch (err: any) {
                    console.error('Call error:', err);
                    toast.error("Kunne ikke starte opkaldet");
                  }
                }}
              >
                <Phone className="mr-2 h-4 w-4" />
                Ring op
              </Button>
              <Button
                onClick={() => setShowNewApplicationDialog(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Ny ansøgning
              </Button>
            </div>
          </div>

          <NewApplicationDialog
            open={showNewApplicationDialog}
            onOpenChange={setShowNewApplicationDialog}
            candidateId={candidate.id}
            candidateName={`${candidate.first_name} ${candidate.last_name}`}
            onSuccess={fetchCandidateData}
          />

          {showSoftphone && userId && (
            <Softphone
              userId={userId}
              initialPhoneNumber={softphoneInitialNumber}
              onClose={() => {
                setShowSoftphone(false);
                setSoftphoneInitialNumber('');
              }}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-2xl">
                  {candidate.first_name} {candidate.last_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <a href={`mailto:${candidate.email}`} className="hover:text-primary">
                    {candidate.email}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <button
                    onClick={async () => {
                      try {
                        const { data, error } = await supabase.functions.invoke('call-candidate', {
                          body: { candidatePhone: candidate.phone }
                        });
                        
                        if (error) throw error;
                        
                        toast.success("Twilio ringer dig op nu og forbinder til kandidaten");
                      } catch (err: any) {
                        console.error('Call error:', err);
                        toast.error("Kunne ikke starte opkaldet");
                      }
                    }}
                    className="hover:text-primary hover:underline cursor-pointer text-left"
                  >
                    {candidate.phone}
                  </button>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Første ansøgning: {format(new Date(candidate.created_at), "d. MMMM yyyy", { locale: da })}</span>
                </div>
                {candidate.notes && (
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">Generelle noter</h4>
                    <p className="text-sm text-muted-foreground">{candidate.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Oversigt</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Total ansøgninger</div>
                  <div className="text-2xl font-bold">{applications.length}</div>
                </div>
                <Separator />
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Kommunikationer</div>
                  <div className="text-2xl font-bold">{communications.length}</div>
                </div>
                {performanceReviews.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Performance reviews</div>
                      <div className="text-2xl font-bold">{performanceReviews.length}</div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="applications" className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto">
              <TabsTrigger value="applications">Ansøgninger</TabsTrigger>
              <TabsTrigger value="communication">Kommunikation</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="applications" className="space-y-4">
              {applications.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Ingen ansøgninger fundet
                  </CardContent>
                </Card>
              ) : (
                applications.map((app) => (
                  <Card key={app.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            {/* Role selector */}
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Rolle:</span>
                              <Select
                                value={app.role}
                                onValueChange={(value) => handleRoleChange(app.id, value)}
                              >
                                <SelectTrigger className="h-8 w-auto gap-2 border-0 bg-transparent p-0 focus:ring-0">
                                  <SelectValue>
                                    <Badge className={roleColors[app.role]}>
                                      {roleLabels[app.role]}
                                    </Badge>
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="bg-popover z-50">
                                  <SelectItem value="fieldmarketing">Fieldmarketing</SelectItem>
                                  <SelectItem value="salgskonsulent">Salgskonsulent</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Status selector */}
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Status:</span>
                              <Select
                                value={app.status}
                                onValueChange={(value) => handleStatusChange(app.id, value)}
                              >
                                <SelectTrigger className="h-8 w-auto gap-2 border-0 bg-transparent p-0 focus:ring-0">
                                  <SelectValue>
                                    <Badge className={statusColors[app.status]}>
                                      {statusLabels[app.status]}
                                    </Badge>
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="bg-popover z-50">
                                  <SelectItem value="ny">Ny</SelectItem>
                                  <SelectItem value="telefon_screening">Telefon-screening</SelectItem>
                                  <SelectItem value="case_rollespil">Case/Rollespil</SelectItem>
                                  <SelectItem value="interview">Interview</SelectItem>
                                  <SelectItem value="tilbud">Tilbud</SelectItem>
                                  <SelectItem value="ansat">Ansat</SelectItem>
                                  <SelectItem value="afslag">Afslag</SelectItem>
                                  <SelectItem value="ghosted_cold">Ghosted/Cold</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Source selector */}
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Kilde:</span>
                              <Select
                                value={app.source || "none"}
                                onValueChange={(value) => handleSourceChange(app.id, value === "none" ? "" : value)}
                              >
                                <SelectTrigger className="h-8 w-auto gap-2 border-0 bg-transparent p-0 focus:ring-0">
                                  <SelectValue>
                                    <Badge variant="outline">
                                      {app.source || "Ikke angivet"}
                                    </Badge>
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="bg-popover z-50">
                                  <SelectItem value="none">Ikke angivet</SelectItem>
                                  <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                                  <SelectItem value="Jobindex">Jobindex</SelectItem>
                                  <SelectItem value="Indeed">Indeed</SelectItem>
                                  <SelectItem value="Facebook">Facebook</SelectItem>
                                  <SelectItem value="Direkte">Direkte</SelectItem>
                                  <SelectItem value="Referral">Referral</SelectItem>
                                  <SelectItem value="Zapier">Zapier</SelectItem>
                                  <SelectItem value="Andet">Andet</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Team selector - always visible */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm text-muted-foreground">
                              Team {app.status === "ansat" && <span className="text-destructive">*</span>}:
                            </span>
                            <Select
                              value={app.team_id || "none"}
                              onValueChange={(value) => handleTeamChange(app.id, value === "none" ? "" : value)}
                            >
                              <SelectTrigger className="h-8 w-auto gap-2 border-0 bg-transparent p-0 focus:ring-0">
                                <SelectValue>
                                  <Badge variant="outline" className={app.team_id ? "bg-primary/10 text-primary border-primary/20" : ""}>
                                    {teams.find(t => t.id === app.team_id)?.name || "Vælg team"}
                                  </Badge>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-50">
                                <SelectItem value="none">Ingen team</SelectItem>
                                {teams.map(team => (
                                  <SelectItem key={team.id} value={team.id}>
                                    {team.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="text-sm text-muted-foreground mb-2">
                            {format(new Date(app.application_date), "d. MMMM yyyy 'kl.' HH:mm", { locale: da })}
                          </div>

                          {/* Quick actions */}
                          <div className="flex items-center gap-2 mt-3">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={async () => {
                                try {
                                  const { data, error } = await supabase.functions.invoke('call-candidate', {
                                    body: { candidatePhone: candidate.phone }
                                  });
                                  
                                  if (error) throw error;
                                  
                                  toast.success("Twilio ringer dig op nu og forbinder til kandidaten");
                                } catch (err: any) {
                                  console.error('Call error:', err);
                                  toast.error("Kunne ikke starte opkaldet");
                                }
                              }}
                              className="h-8"
                            >
                              <Phone className="h-3.5 w-3.5 mr-1.5" />
                              Ring op
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => window.open(`mailto:${candidate.email}`)}
                              className="h-8"
                            >
                              <Mail className="h-3.5 w-3.5 mr-1.5" />
                              Email
                            </Button>
                          </div>
                        </div>
                      </div>

                      {app.next_step && (
                        <div className="mb-3 p-3 bg-muted/50 rounded">
                          <span className="font-medium text-sm">Næste skridt:</span>
                          <p className="text-sm">{app.next_step}</p>
                        </div>
                      )}

                      {app.deadline && (
                        <div className="text-sm text-muted-foreground mb-3">
                          <strong>Deadline:</strong> {format(new Date(app.deadline), "d. MMMM yyyy", { locale: da })}
                        </div>
                      )}

                       {app.notes && (
                         <div className="mb-3 p-3 bg-muted/50 rounded">
                           <span className="font-medium text-sm">Ansøgningstekst:</span>
                           <p className="text-sm mt-1 whitespace-pre-wrap">{app.notes}</p>
                         </div>
                       )}

                      {app.rejection_reason && (
                        <div className="mt-3 p-3 bg-destructive/10 rounded text-sm">
                          <strong>Afslagsårsag:</strong> {app.rejection_reason}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="communication" className="space-y-4">
              {communications.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Ingen kommunikation registreret
                  </CardContent>
                </Card>
              ) : (
                communications.map((comm) => (
                  <Card key={comm.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="mt-1">
                          {comm.type === "email" && <Mail className="h-5 w-5 text-primary" />}
                          {comm.type === "sms" && <MessageSquare className="h-5 w-5 text-primary" />}
                          {comm.type === "phone" && <PhoneCall className="h-5 w-5 text-primary" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="capitalize">
                              {comm.type}
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {comm.direction === "inbound" ? "Indgående" : "Udgående"}
                            </Badge>
                            <span className="text-sm text-muted-foreground ml-auto">
                              {format(new Date(comm.created_at), "d. MMM yyyy HH:mm", { locale: da })}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground mb-1">
                            Tilhører: {roleLabels[comm.application.role]} ansøgning
                          </div>
                          {comm.content && (
                            <p className="text-sm mt-2">{comm.content}</p>
                          )}
                          {comm.outcome && (
                            <div className="mt-2 text-sm">
                              <strong>Resultat:</strong> {comm.outcome}
                            </div>
                          )}
                          {comm.duration && (
                            <div className="text-sm text-muted-foreground">
                              Varighed: {Math.floor(comm.duration / 60)} min {comm.duration % 60} sek
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              {performanceReviews.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Ingen performance reviews endnu</p>
                    <p className="text-xs mt-1">Performance data vises kun for ansatte kandidater</p>
                  </CardContent>
                </Card>
              ) : (
                performanceReviews.map((review) => (
                  <Card key={review.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className={`h-5 w-5 ${getRatingColor(review.rating)}`} />
                            <span className="font-semibold">{review.review_period} dage review</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {roleLabels[review.application.role]} position
                          </div>
                        </div>
                        <Badge className={`${getRatingColor(review.rating)} bg-transparent border`}>
                          Rating: {review.rating}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mb-3">
                        {format(new Date(review.review_date), "d. MMMM yyyy", { locale: da })}
                      </div>
                      {review.comments && (
                        <div className="p-3 bg-muted/50 rounded">
                          <p className="text-sm">{review.comments}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {candidate && (
        <EditCandidateDialog
          candidate={candidate}
          open={showEditCandidateDialog}
          onOpenChange={setShowEditCandidateDialog}
          onSuccess={fetchCandidateData}
        />
      )}

      <NewApplicationDialog
        open={showNewApplicationDialog}
        onOpenChange={setShowNewApplicationDialog}
        candidateId={id!}
        candidateName={`${candidate?.first_name} ${candidate?.last_name}`}
        onSuccess={() => {
          fetchCandidateData();
        }}
      />

      {showSoftphone && (
        <Softphone
          userId={userId}
          onClose={() => setShowSoftphone(false)}
        />
      )}

      {/* Hired Date Dialog */}
      <Dialog open={showHiredDateDialog} onOpenChange={setShowHiredDateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Angiv ansættelsesdato</DialogTitle>
            <DialogDescription>
              For at markere kandidaten som ansat skal du angive ansættelsesdatoen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Ansættelsesdato *</Label>
              <Input
                type="date"
                value={hiredDate}
                onChange={(e) => setHiredDate(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowHiredDateDialog(false);
                  setPendingStatusChange(null);
                  setHiredDate('');
                }}
              >
                Annuller
              </Button>
              <Button onClick={handleConfirmHiredDate}>
                Bekræft ansættelse
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CandidateProfile;
