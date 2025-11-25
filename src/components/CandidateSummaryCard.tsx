import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Clock, FileText } from "lucide-react";

interface Note {
  id: string;
  content: string;
  note_type: string;
  created_at: string;
}

interface Application {
  id: string;
  next_step?: string;
  deadline?: string;
  status: string;
}

interface CandidateSummaryCardProps {
  latestNote?: Note;
  latestApplication?: Application;
}

export const CandidateSummaryCard = ({ latestNote, latestApplication }: CandidateSummaryCardProps) => {
  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Latest note */}
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground mb-1">Seneste note</div>
              {latestNote ? (
                <>
                  <p className="text-sm line-clamp-2 mb-1">
                    {latestNote.content}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(latestNote.created_at), "d. MMM HH:mm", { locale: da })}
                  </span>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Ingen noter endnu</p>
              )}
            </div>
          </div>

          {/* Next action */}
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground mb-1">Næste handling</div>
              {latestApplication?.next_step ? (
                <>
                  <p className="text-sm mb-1">
                    {latestApplication.next_step}
                  </p>
                  {latestApplication.deadline && (
                    <Badge variant="outline" className="text-xs">
                      Deadline: {format(new Date(latestApplication.deadline), "d. MMM", { locale: da })}
                    </Badge>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Ingen næste handling sat</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
