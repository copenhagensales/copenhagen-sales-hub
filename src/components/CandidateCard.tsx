import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Mail, 
  Phone, 
  FileText, 
  Calendar, 
  ChevronDown, 
  User,
  Clock,
  AlertCircle,
  Trash2
} from "lucide-react";
import { format, differenceInHours, differenceInDays } from "date-fns";
import { da } from "date-fns/locale";
import { Softphone } from "@/components/Softphone";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Application {
  id: string;
  role: string;
  status: string;
  application_date: string;
  deadline?: string;
  next_step?: string;
  source?: string;
  notes?: string;
  team_id?: string;
  hired_date?: string;
}

interface CandidateCardProps {
  candidate: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    notes?: string;
    created_at: string;
  };
  applications: Application[];
  teams?: any[];
  onUpdate?: () => void;
}

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

export const CandidateCard = ({ candidate, applications, teams = [], onUpdate }: CandidateCardProps) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [showSoftphone, setShowSoftphone] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showHiredDateDialog, setShowHiredDateDialog] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ applicationId: string; newStatus: string } | null>(null);
  const [hiredDate, setHiredDate] = useState<string>('');
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUserId();
  }, []);

  const latestApplication = applications[0];

  const getTimeSinceApplication = (dateString: string) => {
    const date = new Date(dateString);
    const hours = differenceInHours(new Date(), date);
    
    if (hours < 24) {
      return `${hours}t`;
    }
    
    const days = differenceInDays(new Date(), date);
    return `${days}d`;
  };

  const handleEmailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `mailto:${candidate.email}`;
  };

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSoftphone(true);
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/candidates/${candidate.id}`);
  };

  const handleCardClick = () => {
    navigate(`/candidates/${candidate.id}`);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const { error } = await supabase
        .from("candidates")
        .delete()
        .eq("id", candidate.id);

      if (error) throw error;

      toast.success("Kandidat slettet");
      if (onUpdate) {
        onUpdate();
      } else {
        window.location.reload();
      }
    } catch (error: any) {
      toast.error("Kunne ikke slette kandidat");
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
      if (onUpdate) onUpdate();
    } catch (error: any) {
      toast.error("Kunne ikke opdatere team");
      console.error(error);
    }
  };

  const handleStatusChange = async (applicationId: string, newStatus: string) => {
    try {
      const app = applications.find(a => a.id === applicationId);
      
      // If changing to "ansat", check if team and hired_date are set
      if (newStatus === "ansat") {
        if (!app?.team_id) {
          toast.error("Du skal vælge et team før du kan sætte status til Ansat");
          return;
        }
        
        // Check if hired_date is set, if not show dialog
        if (!app?.hired_date) {
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
      if (onUpdate) onUpdate();
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
      if (onUpdate) onUpdate();
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
      if (onUpdate) onUpdate();
    } catch (error: any) {
      toast.error("Kunne ikke opdatere kilde");
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
      if (onUpdate) onUpdate();
    } catch (error: any) {
      toast.error("Kunne ikke opdatere status");
      console.error(error);
    }
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card 
          className="hover:shadow-md transition-all duration-200 hover:border-primary/50 cursor-pointer"
          onClick={handleCardClick}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              {/* Left side - Basic info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate">
                      {candidate.first_name} {candidate.last_name}
                    </h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{candidate.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{candidate.phone}</span>
                      </div>
                    </div>

                    {/* Latest application info */}
                    {latestApplication && (
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <Badge className={roleColors[latestApplication.role]} variant="outline">
                          {roleLabels[latestApplication.role]}
                        </Badge>
                        <Badge className={statusColors[latestApplication.status]} variant="outline">
                          {statusLabels[latestApplication.status]}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {getTimeSinceApplication(latestApplication.application_date)}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Right side - Badges and actions */}
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className="whitespace-nowrap">
                      <FileText className="h-3 w-3 mr-1" />
                      {applications.length}
                    </Badge>
                    {applications.length > 1 && (
                      <span className="text-xs text-amber-600 font-medium">
                        {applications.length} ansøgninger
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-2 mt-3">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handlePhoneClick}
                    className="h-8"
                  >
                    <Phone className="h-3.5 w-3.5 mr-1.5" />
                    Ring op
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleEmailClick}
                    className="h-8"
                  >
                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                    Email
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleProfileClick}
                    className="h-8"
                  >
                    <User className="h-3.5 w-3.5 mr-1.5" />
                    Profil
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleDeleteClick}
                    className="h-8 text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Slet
                  </Button>
                  
                  {applications.length > 0 && (
                    <CollapsibleTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="h-8 ml-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ChevronDown 
                          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} 
                        />
                      </Button>
                    </CollapsibleTrigger>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded content - All applications */}
            <CollapsibleContent>
              <div className="mt-4 pt-4 border-t space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Alle ansøgninger ({applications.length})
                </h4>
                
                {applications.map((app, index) => (
                  <div 
                    key={app.id}
                    className="bg-muted/30 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Role selector */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Rolle:</span>
                          <Select
                            value={app.role}
                            onValueChange={(value) => handleRoleChange(app.id, value)}
                          >
                            <SelectTrigger className="h-7 w-auto gap-2 border-0 bg-transparent p-0 focus:ring-0">
                              <SelectValue>
                                <Badge className={roleColors[app.role]} variant="outline">
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
                          <span className="text-xs text-muted-foreground">Status:</span>
                          <Select
                            value={app.status}
                            onValueChange={(value) => handleStatusChange(app.id, value)}
                          >
                            <SelectTrigger className="h-7 w-auto gap-2 border-0 bg-transparent p-0 focus:ring-0">
                              <SelectValue>
                                <Badge className={statusColors[app.status]} variant="outline">
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

                        {index === 0 && (
                          <Badge variant="secondary" className="text-xs">Seneste</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(app.application_date), "d. MMM yyyy", { locale: da })}
                      </div>
                    </div>

                    {/* Source selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Kilde:</span>
                      <Select
                        value={app.source || "none"}
                        onValueChange={(value) => handleSourceChange(app.id, value === "none" ? "" : value)}
                      >
                        <SelectTrigger className="h-7 w-auto gap-2 text-xs">
                          <SelectValue>
                            {app.source || "Ikke angivet"}
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

                    {teams.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Team {app.status === "ansat" && <span className="text-destructive">*</span>}:
                        </span>
                        <Select
                          value={app.team_id || "none"}
                          onValueChange={(value) => handleTeamChange(app.id, value === "none" ? "" : value)}
                        >
                          <SelectTrigger className="h-7 w-auto gap-2 text-xs">
                            <SelectValue>
                              {teams.find(t => t.id === app.team_id)?.name || "Vælg team"}
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
                    )}

                    {app.next_step && (
                      <div className="text-sm">
                        <span className="font-medium">Næste skridt:</span> {app.next_step}
                      </div>
                    )}

                    {app.deadline && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                        <span className="font-medium">Deadline:</span>
                        <span>{format(new Date(app.deadline), "d. MMM yyyy", { locale: da })}</span>
                      </div>
                    )}

                    {app.notes && (
                      <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/30 rounded">
                        <span className="font-medium">Ansøgningstekst: </span>
                        <span className="whitespace-pre-wrap">{app.notes}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </CardContent>
        </Card>
      </Collapsible>

      {showSoftphone && userId && (
        <Softphone 
          userId={userId}
          onClose={() => setShowSoftphone(false)}
          initialPhoneNumber={candidate.phone}
        />
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet kandidat</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil slette {candidate.first_name} {candidate.last_name}? 
              Dette vil også slette alle tilknyttede ansøgninger. Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Slet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </>
  );
};
