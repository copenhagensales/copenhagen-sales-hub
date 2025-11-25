import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarIcon, UserIcon, Clock } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface ApplicationCardProps {
  application: {
    id: string;
    role: string;
    status: string;
    source?: string;
    deadline?: string;
    next_step?: string;
    responsible_user_id?: string;
    candidate: {
      first_name: string;
      last_name: string;
      email: string;
    };
    application_date: string;
    previous_applications_count?: number;
  };
  onClick: () => void;
}

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

export const ApplicationCard = ({ application, onClick }: ApplicationCardProps) => {
  const isOverdue = application.deadline && new Date(application.deadline) < new Date();

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/50"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">
                  {application.candidate.first_name} {application.candidate.last_name}
                </h3>
                <p className="text-sm text-muted-foreground">{application.candidate.email}</p>
              </div>
              {application.previous_applications_count && application.previous_applications_count > 0 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  Har søgt før ({application.previous_applications_count})
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className={roleColors[application.role]}>
                {roleLabels[application.role]}
              </Badge>
              <Badge className={statusColors[application.status]}>
                {statusLabels[application.status]}
              </Badge>
              {application.source && (
                <Badge variant="outline">{application.source}</Badge>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                <span>{format(new Date(application.application_date), "d. MMM yyyy", { locale: da })}</span>
              </div>
              
              {application.deadline && (
                <div className={`flex items-center gap-1 ${isOverdue ? "text-destructive font-medium" : ""}`}>
                  <Clock className="h-3 w-3" />
                  <span>Deadline: {format(new Date(application.deadline), "d. MMM", { locale: da })}</span>
                </div>
              )}
              
              {application.responsible_user_id && (
                <div className="flex items-center gap-1">
                  <UserIcon className="h-3 w-3" />
                  <span>Ansvarlig</span>
                </div>
              )}
            </div>

            {application.next_step && (
              <div className="text-sm bg-muted/50 rounded p-2">
                <span className="font-medium">Næste skridt:</span> {application.next_step}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
