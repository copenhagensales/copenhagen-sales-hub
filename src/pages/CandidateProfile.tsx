import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { NewApplicationDialog } from "@/components/NewApplicationDialog";
import { EditCandidateDialog } from "@/components/EditCandidateDialog";
import { Softphone } from "@/components/Softphone";
import { CallStatusDialog } from "@/components/CallStatusDialog";
import { SendSmsDialog } from "@/components/SendSmsDialog";
import { QuickNotesSidebar } from "@/components/QuickNotesSidebar";
import { CommunicationTimeline } from "@/components/CommunicationTimeline";
import { ScheduleInterviewDialog } from "@/components/ScheduleInterviewDialog";
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
  MessageCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  interview_date?: string;
}

interface Communication {
  id: string;
  type: string;
  direction: string;
  content?: string;
  outcome?: string;
  duration?: number;
  created_at: string;
  application_id: string;
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

interface CandidateNote {
  id: string;
  content: string;
  note_type: "call" | "email" | "general" | "important" | "action_item";
  created_at: string;
  created_by: string | null;
}

const CandidateProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [performanceReviews, setPerformanceReviews] = useState<PerformanceReview[]>([]);
  const [candidateNotes, setCandidateNotes] = useState<CandidateNote[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewApplicationDialog, setShowNewApplicationDialog] = useState(false);
  const [showEditCandidateDialog, setShowEditCandidateDialog] = useState(false);
  const [showSoftphone, setShowSoftphone] = useState(false);
  const [softphoneInitialNumber, setSoftphoneInitialNumber] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [showHiredDateDialog, setShowHiredDateDialog] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ applicationId: string; newStatus: string } | null>(
    null,
  );
  const [hiredDate, setHiredDate] = useState<string>("");
  const [showCallStatus, setShowCallStatus] = useState(false);
  const [currentCallSid, setCurrentCallSid] = useState<string>("");
  const [currentCallPhone, setCurrentCallPhone] = useState<string>("");
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [smsApplicationId, setSmsApplicationId] = useState<string>("");
  const [showScheduleInterviewDialog, setShowScheduleInterviewDialog] = useState(false);
  const [selectedApplicationForInterview, setSelectedApplicationForInterview] = useState<string>("");

  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

      // Mark candidate as viewed if not already viewed
      if (candidateData && !candidateData.first_viewed_at) {
        await supabase.from("candidates").update({ first_viewed_at: new Date().toISOString() }).eq("id", id);
      }

      // Fetch teams
      const { data: teamsData, error: teamsError } = await supabase.from("teams").select("*").order("name");

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
          .select(
            `
            *,
            application:applications(role, application_date)
          `,
          )
          .in("application_id", applicationIds)
          .order("created_at", { ascending: false });

        if (commsError) throw commsError;
        setCommunications(commsData || []);

        // Fetch performance reviews
        const { data: reviewsData, error: reviewsError } = await supabase
          .from("performance_reviews")
          .select(
            `
            *,
            application:applications(role)
          `,
          )
          .in("application_id", applicationIds)
          .order("review_date", { ascending: false });

        if (reviewsError) throw reviewsError;
        setPerformanceReviews(reviewsData || []);

        // Fetch candidate notes
        const { data: notesData, error: notesError } = await supabase
          .from("candidate_notes")
          .select("*")
          .eq("candidate_id", id)
          .order("created_at", { ascending: false });

        if (notesError) throw notesError;
        setCandidateNotes((notesData || []) as CandidateNote[]);
      }
    } catch (error: any) {
      toast.error("Kunne ikke hente kandidat data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const statusLabels: Record<string, string> = {
    ny_ansoegning: "Ny ansøgning",
    ansat: "Ansat",
    udskudt_samtale: "Udskudt samtale",
    ikke_kvalificeret: "Ikke kvalificeret",
    ikke_ansat: "Ikke ansat",
    startet: "Startet",
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
        const application = applications.find((app) => app.id === applicationId);
        if (!application?.team_id) {
          toast.error("Du skal vælge et team før du kan sætte status til Ansat");
          return;
        }

        // Check if hired_date is set, if not show dialog
        if (!application?.hired_date) {
          setPendingStatusChange({ applicationId, newStatus });
          setHiredDate(new Date().toISOString().split("T")[0]); // Default to today
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
          hired_date: hiredDate,
        })
        .eq("id", pendingStatusChange.applicationId);

      if (error) throw error;

      toast.success("Medarbejder markeret som ansat!");
      setShowHiredDateDialog(false);
      setPendingStatusChange(null);
      setHiredDate("");
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
      <div className="flex-1 overflow-auto md:pt-0 pt-16">
        <div className="p-4 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <Button variant="ghost" onClick={() => navigate("/candidates")} className="w-full md:w-auto">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Tilbage til kandidater
            </Button>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setShowEditCandidateDialog(true)}
                className="flex-1 md:flex-initial"
              >
                <Edit className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Rediger kandidat</span>
                <span className="md:hidden">Rediger</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(`mailto:${candidate.email}`)}
                className="flex-1 md:flex-initial"
              >
                <Mail className="h-4 w-4 md:mr-2" />
                <span className="hidden sm:inline ml-1">Email</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (applications.length > 0) {
                    setSmsApplicationId(applications[0].id);
                    setShowSmsDialog(true);
                  } else {
                    toast.error("Ingen ansøgninger fundet");
                  }
                }}
                className="flex-1 md:flex-initial"
              >
                <MessageCircle className="h-4 w-4 md:mr-2" />
                <span className="hidden sm:inline ml-1">SMS</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentCallPhone(candidate.phone);
                  setShowCallStatus(true);
                }}
                className="flex-1 md:flex-initial"
              >
                <Phone className="h-4 w-4 md:mr-2" />
                <span className="hidden sm:inline ml-1">Ring op</span>
              </Button>
              <Button onClick={() => setShowNewApplicationDialog(true)} className="w-full md:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Ny ansøgning
              </Button>
            </div>
          </div>

          {/* Main content grid with sidebar */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6 mt-6">
            {/* Left column - Main content */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                        onClick={() => {
                          setCurrentCallPhone(candidate.phone);
                          setShowCallStatus(true);
                        }}
                        className="hover:text-primary hover:underline cursor-pointer text-left"
                      >
                        {candidate.phone}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <div className="flex flex-col gap-1">
                        {applications.length > 1 ? (
                          <>
                            <span className="font-medium">Ansøgningsdatoer:</span>
                            {applications.map((app, index) => (
                              <div key={app.id} className="flex items-center gap-2 text-sm">
                                <span>
                                  {index + 1}. {format(new Date(app.application_date), "d. MMMM yyyy", { locale: da })}
                                </span>
                                {index === 0 && (
                                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                                    Nyeste
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </>
                        ) : (
                          <span>
                            Første ansøgning: {format(new Date(candidate.created_at), "d. MMMM yyyy", { locale: da })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Latest application details */}
                    {applications.length > 0 && (
                      <div className="pt-4 border-t">
                        <h4 className="font-medium mb-3">Nuværende ansøgning</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Rolle:</span>
                            <Select
                              value={applications[0].role}
                              onValueChange={(value) => handleRoleChange(applications[0].id, value)}
                            >
                              <SelectTrigger className="h-8 w-auto gap-2 border-0 bg-transparent p-0 focus:ring-0">
                                <SelectValue>
                                  <Badge className={roleColors[applications[0].role]}>
                                    {roleLabels[applications[0].role]}
                                  </Badge>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-50">
                                <SelectItem value="fieldmarketing">Fieldmarketing</SelectItem>
                                <SelectItem value="salgskonsulent">Salgskonsulent</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Status:</span>
                            <Select
                              value={applications[0].status}
                              onValueChange={(value) => handleStatusChange(applications[0].id, value)}
                            >
                              <SelectTrigger className="h-8 w-auto gap-2 border-0 bg-transparent p-0 focus:ring-0">
                                <SelectValue>
                                  <Badge className={statusColors[applications[0].status]}>
                                    {statusLabels[applications[0].status]}
                                  </Badge>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-50">
                                <SelectItem value="ny_ansoegning">Ny ansøgning</SelectItem>
                                <SelectItem value="startet">Startet</SelectItem>
                                <SelectItem value="udskudt_samtale">Udskudt samtale</SelectItem>
                                <SelectItem value="ikke_kvalificeret">Ikke kvalificeret</SelectItem>
                                <SelectItem value="ikke_ansat">Ikke ansat</SelectItem>
                                <SelectItem value="ansat">Ansat</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Kilde:</span>
                            <Select
                              value={applications[0].source || "none"}
                              onValueChange={(value) =>
                                handleSourceChange(applications[0].id, value === "none" ? "" : value)
                              }
                            >
                              <SelectTrigger className="h-8 w-auto gap-2 border-0 bg-transparent p-0 focus:ring-0">
                                <SelectValue>
                                  <Badge variant="outline">{applications[0].source || "Ikke angivet"}</Badge>
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
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Team:</span>
                            <Select
                              value={applications[0].team_id || "none"}
                              onValueChange={(value) =>
                                handleTeamChange(applications[0].id, value === "none" ? "" : value)
                              }
                            >
                              <SelectTrigger className="h-8 w-auto gap-2 border-0 bg-transparent p-0 focus:ring-0">
                                <SelectValue>
                                  <Badge
                                    variant="outline"
                                    className={
                                      applications[0].team_id ? "bg-primary/10 text-primary border-primary/20" : ""
                                    }
                                  >
                                    {teams.find((t) => t.id === applications[0].team_id)?.name || "Ikke valgt"}
                                  </Badge>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-50">
                                <SelectItem value="none">Ingen team</SelectItem>
                                {teams.map((team) => (
                                  <SelectItem key={team.id} value={team.id}>
                                    {team.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Interview date section */}
                    {applications.length > 0 && (
                      <div className="pt-4 border-t">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">Jobsamtale</h4>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedApplicationForInterview(applications[0].id);
                              setShowScheduleInterviewDialog(true);
                            }}
                          >
                            <Calendar className="h-3.5 w-3.5 mr-1.5" />
                            {applications[0].interview_date ? "Rediger" : "Planlæg"}
                          </Button>
                        </div>
                        {applications[0].interview_date ? (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Planlagt: </span>
                            <span className="font-medium">
                              {format(new Date(applications[0].interview_date), "d. MMMM yyyy 'kl.' HH:mm", {
                                locale: da,
                              })}
                            </span>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Ingen samtale planlagt</p>
                        )}
                      </div>
                    )}

                    {candidate.notes && (
                      <div className="pt-4 border-t">
                        <h4 className="font-medium mb-2">Ansøgning fra kandidat</h4>
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
                      <h4 className="text-sm font-medium mb-3">Kommunikationsstatistik</h4>
                      <div className="space-y-3">
                        {(() => {
                          const phoneCalls = communications.filter((c) => c.type === "phone");
                          const emails = communications.filter((c) => c.type === "email");
                          const smsMessages = communications.filter((c) => c.type === "sms");

                          const totalCalls = phoneCalls.length;
                          const totalEmails = emails.length;
                          const totalSms = smsMessages.length;

                          if (totalCalls === 0 && totalEmails === 0 && totalSms === 0) {
                            return (
                              <div className="text-sm text-muted-foreground text-center py-2">
                                Ingen kommunikation registreret
                              </div>
                            );
                          }

                          return (
                            <>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Opkald</span>
                                <Badge variant="outline">{totalCalls}</Badge>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Emails</span>
                                <Badge variant="outline">{totalEmails}</Badge>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">SMS</span>
                                <Badge variant="outline">{totalSms}</Badge>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Communication Section */}
              <div className="w-full">
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle>Kommunikation</CardTitle>
                  </CardHeader>
                </Card>

                <div className="space-y-4">
                  {communications.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        Ingen kommunikation registreret
                      </CardContent>
                    </Card>
                  ) : (
                    communications.map((comm) => (
                      <Card key={comm.id} className={comm.direction === "inbound" ? "border-l-4 border-l-primary" : ""}>
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
                                  {comm.type === "sms" ? "SMS" : comm.type}
                                </Badge>
                                <Badge
                                  variant={comm.direction === "inbound" ? "default" : "outline"}
                                  className="capitalize"
                                >
                                  {comm.direction === "inbound" ? "📩 Indgående" : "📤 Udgående"}
                                </Badge>
                                <span className="text-sm text-muted-foreground ml-auto">
                                  {format(new Date(comm.created_at), "d. MMM yyyy HH:mm", { locale: da })}
                                </span>
                              </div>
                              <div className="text-sm text-muted-foreground mb-1">
                                Tilhører: {roleLabels[comm.application.role]} ansøgning
                              </div>
                              {comm.content && (
                                <p className="text-sm mt-2 p-3 bg-muted/30 rounded border">{comm.content}</p>
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
                              {/* Reply button for inbound SMS */}
                              {comm.type === "sms" && comm.direction === "inbound" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSmsApplicationId(comm.application_id);
                                    setShowSmsDialog(true);
                                  }}
                                  className="mt-3"
                                >
                                  <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                                  Svar på SMS
                                </Button>
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

            {/* Right column - Quick Notes Sidebar */}
            <div className="hidden xl:block sticky top-6 h-[calc(100vh-120px)]">
              <QuickNotesSidebar candidateId={candidate.id} notes={candidateNotes} onNotesUpdate={fetchCandidateData} />
            </div>
          </div>
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
            setSoftphoneInitialNumber("");
          }}
        />
      )}

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

      {showCallStatus && applications[0] && (
        <CallStatusDialog
          candidateName={`${candidate.first_name} ${candidate.last_name}`}
          candidatePhone={currentCallPhone}
          applicationId={applications[0].id}
          onHangup={() => {
            setShowCallStatus(false);
            setCurrentCallSid("");
            setCurrentCallPhone("");
            fetchCandidateData(); // Refresh to show new call log
            toast.success("Opkald afsluttet");
          }}
        />
      )}

      {showSmsDialog && candidate && (
        <SendSmsDialog
          open={showSmsDialog}
          onOpenChange={setShowSmsDialog}
          candidatePhone={candidate.phone}
          candidateName={`${candidate.first_name} ${candidate.last_name}`}
          applicationId={smsApplicationId}
          onSmsSent={() => {
            fetchCandidateData(); // Refresh to show new SMS log
          }}
        />
      )}

      {/* Hired Date Dialog */}
      <Dialog open={showHiredDateDialog} onOpenChange={setShowHiredDateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Angiv ansættelsesdato</DialogTitle>
            <DialogDescription>For at markere kandidaten som ansat skal du angive ansættelsesdatoen</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Ansættelsesdato *</Label>
              <Input type="date" value={hiredDate} onChange={(e) => setHiredDate(e.target.value)} required />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowHiredDateDialog(false);
                  setPendingStatusChange(null);
                  setHiredDate("");
                }}
              >
                Annuller
              </Button>
              <Button onClick={handleConfirmHiredDate}>Bekræft ansættelse</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Interview Dialog */}
      {applications.length > 0 && (
        <ScheduleInterviewDialog
          open={showScheduleInterviewDialog}
          onOpenChange={setShowScheduleInterviewDialog}
          applicationId={selectedApplicationForInterview}
          currentInterviewDate={applications.find((a) => a.id === selectedApplicationForInterview)?.interview_date}
          onSuccess={fetchCandidateData}
        />
      )}
    </div>
  );
};

export default CandidateProfile;
