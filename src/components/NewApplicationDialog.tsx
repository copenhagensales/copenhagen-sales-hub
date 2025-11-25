import { useState } from "react";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!role) {
      toast.error("Vælg venligst en rolle");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.from("applications").insert([
        {
          candidate_id: candidateId,
          role: role,
          source: source || undefined,
          notes: notes || undefined,
          status: "ny",
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
              <SelectContent>
                <SelectItem value="fieldmarketing">Fieldmarketing</SelectItem>
                <SelectItem value="salgskonsulent">Salgskonsulent</SelectItem>
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
            <Label htmlFor="notes">Noter</Label>
            <Textarea
              id="notes"
              placeholder="Tilføj eventuelle noter..."
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
