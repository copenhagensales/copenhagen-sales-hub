import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

export const CandidateCard = ({ candidate, applications }: CandidateCardProps) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [showSoftphone, setShowSoftphone] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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
      window.location.reload();
    } catch (error: any) {
      toast.error("Kunne ikke slette kandidat");
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
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={roleColors[app.role]} variant="outline">
                          {roleLabels[app.role]}
                        </Badge>
                        <Badge className={statusColors[app.status]} variant="outline">
                          {statusLabels[app.status]}
                        </Badge>
                        {index === 0 && (
                          <Badge variant="secondary" className="text-xs">Seneste</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(app.application_date), "d. MMM yyyy", { locale: da })}
                      </div>
                    </div>

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

                    {app.source && (
                      <div className="text-xs text-muted-foreground">
                        Kilde: {app.source}
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
    </>
  );
};
