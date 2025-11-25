import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NewCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const NewCandidateDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: NewCandidateDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.first_name || !formData.last_name || !formData.email || !formData.phone) {
        toast.error("Udfyld venligst alle påkrævede felter");
        return;
      }

      // Check if candidate already exists
      const { data: existingCandidate } = await supabase
        .from("candidates")
        .select("id")
        .or(`email.eq.${formData.email},phone.eq.${formData.phone}`)
        .maybeSingle();

      if (existingCandidate) {
        toast.error("En kandidat med denne email eller telefon findes allerede");
        return;
      }

      // Create candidate
      const { data: newCandidate, error: candidateError } = await supabase
        .from("candidates")
        .insert({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          notes: formData.notes.trim() || null,
        })
        .select()
        .single();

      if (candidateError) throw candidateError;

      // Create a default application for the candidate
      const { error: applicationError } = await supabase
        .from("applications")
        .insert({
          candidate_id: newCandidate.id,
          role: "salgskonsulent", // Default role
          status: "ny",
          source: "Direkte",
          application_date: new Date().toISOString(),
        });

      if (applicationError) throw applicationError;

      toast.success("Kandidat og ansøgning oprettet!");
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        notes: "",
      });
    } catch (error: any) {
      console.error("Error creating candidate:", error);
      toast.error("Kunne ikke oprette kandidat");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Tilføj ny kandidat</DialogTitle>
          <DialogDescription>
            Opret en ny kandidat i systemet manuelt
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="first_name">
                Fornavn <span className="text-destructive">*</span>
              </Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) =>
                  setFormData({ ...formData, first_name: e.target.value })
                }
                placeholder="Indtast fornavn"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="last_name">
                Efternavn <span className="text-destructive">*</span>
              </Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) =>
                  setFormData({ ...formData, last_name: e.target.value })
                }
                placeholder="Indtast efternavn"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="navn@eksempel.dk"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">
                Telefon <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+45 12 34 56 78"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Noter (valgfrit)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Tilføj noter om kandidaten..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annuller
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Opretter..." : "Opret kandidat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
