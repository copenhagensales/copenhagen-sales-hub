import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface NewApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  onSuccess: () => void;
}

export const NewApplicationDialog = ({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  onSuccess,
}: NewApplicationDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState<string>("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("ny");
  const [teamId, setTeamId] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [deadline, setDeadline] = useState("");
  const [teams, setTeams] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      fetchTeams();
    }
  }, [open]);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("name");

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error("Error fetching teams:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!role) {
      toast.error("Vælg venligst en rolle");
      return;
    }

    if (!nextStep) {
      toast.error("Næste skridt er påkrævet");
      return;
    }

    if (!deadline) {
      toast.error("Deadline er påkrævet");
      return;
    }

    if (status === "ansat" && !teamId) {
      toast.error("Team er påkrævet når status er Ansat");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.from("applications").insert([
        {
          candidate_id: candidateId,
          role: role,
          status: status,
          source: source || undefined,
          notes: notes || undefined,
          team_id: teamId || undefined,
          next_step: nextStep,
          deadline: deadline,
        } as any,
      ]);

      if (error) throw error;

      toast.success("Ny ansøgning oprettet!");
      onOpenChange(false);
      onSuccess();
      
      // Reset form
      setRole("");
      setSource("");
      setNotes("");
      setStatus("ny");
      setTeamId("");
      setNextStep("");
      setDeadline("");
    } catch (error: any) {
      toast.error("Kunne ikke oprette ansøgning");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Opret ny ansøgning</DialogTitle>
          <DialogDescription>
            Opret en ny ansøgning for {candidateName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role">Rolle *</Label>
            <Select value={role} onValueChange={setRole} required>
              <SelectTrigger>
                <SelectValue placeholder="Vælg rolle" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="fieldmarketing">Fieldmarketing</SelectItem>
                <SelectItem value="salgskonsulent">Salgskonsulent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
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

          <div className="space-y-2">
            <Label htmlFor="team">Team {status === "ansat" && <span className="text-destructive">*</span>}</Label>
            <Select value={teamId || "none"} onValueChange={(value) => setTeamId(value === "none" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg team" />
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

          <div className="space-y-2">
            <Label htmlFor="source">Kilde</Label>
            <Input
              id="source"
              placeholder="f.eks. LinkedIn, Jobindex, Indeed..."
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="next_step">Næste skridt *</Label>
            <Input
              id="next_step"
              placeholder="f.eks. Ring tilbage i morgen"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline *</Label>
            <Input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Noter / Ansøgningstekst</Label>
            <Textarea
              id="notes"
              placeholder="Tilføj eventuelle noter eller ansøgningstekst..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isLoading}
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Annuller
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Opret ansøgning
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
