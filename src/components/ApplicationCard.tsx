import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarIcon, UserIcon, Clock, ChevronDown } from "lucide-react";
import { format, differenceInHours, differenceInDays } from "date-fns";
import { da } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

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
  const [isOpen, setIsOpen] = useState(false);
  const isOverdue = application.deadline && new Date(application.deadline) < new Date();
  
  const getTimeSinceApplication = () => {
    const now = new Date();
    const applicationDate = new Date(application.application_date);
    const hoursDiff = differenceInHours(now, applicationDate);
    
    if (hoursDiff < 24) {
      return `${hoursDiff}t`;
    } else {
      const daysDiff = differenceInDays(now, applicationDate);
      return `${daysDiff}d`;
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="hover:shadow-md transition-all duration-200 hover:border-primary/50">
        <CardContent className="p-3">
          <CollapsibleTrigger className="w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-base truncate">
                      {application.candidate.first_name} {application.candidate.last_name}
                    </h3>
                    <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border text-xs">
                      {getTimeSinceApplication()}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2 items-center flex-shrink-0">
                  <Badge className={`${roleColors[application.role]} text-xs`}>
                    {roleLabels[application.role]}
                  </Badge>
                  <Badge className={`${statusColors[application.status]} text-xs`}>
                    {statusLabels[application.status]}
                  </Badge>
                  {application.previous_applications_count && application.previous_applications_count > 0 && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                      {application.previous_applications_count}x
                    </Badge>
                  )}
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} />
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="pt-3 space-y-3 border-t mt-3" onClick={onClick}>
              <p className="text-sm text-muted-foreground">{application.candidate.email}</p>

              {application.source && (
                <Badge variant="outline" className="text-xs">{application.source}</Badge>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
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
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
};
