import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ScheduleInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  currentInterviewDate?: string;
  onSuccess: () => void;
}

export function ScheduleInterviewDialog({
  open,
  onOpenChange,
  applicationId,
  currentInterviewDate,
  onSuccess,
}: ScheduleInterviewDialogProps) {
  const [date, setDate] = useState<Date | undefined>(
    currentInterviewDate ? new Date(currentInterviewDate) : undefined
  );
  const [time, setTime] = useState(
    currentInterviewDate
      ? format(new Date(currentInterviewDate), "HH:mm")
      : "10:00"
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!date) {
      toast.error("Vælg en dato");
      return;
    }

    setLoading(true);
    try {
      // Combine date and time
      const [hours, minutes] = time.split(":");
      const interviewDateTime = new Date(date);
      interviewDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const { error } = await supabase
        .from("applications")
        .update({ interview_date: interviewDateTime.toISOString() })
        .eq("id", applicationId);

      if (error) throw error;

      toast.success("Samtale planlagt!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Kunne ikke planlægge samtale");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Indkald til jobsamtale</DialogTitle>
          <DialogDescription>
            Vælg dato og tidspunkt for jobsamtalen
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Dato *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal mt-1",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: da }) : <span>Vælg dato</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  locale={da}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Tidspunkt *</Label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annuller
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Gemmer..." : "Gem samtale"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
