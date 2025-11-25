import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { StickyNote, Phone, Mail, AlertCircle, CheckCircle, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Note {
  id: string;
  content: string;
  note_type: 'call' | 'email' | 'general' | 'important' | 'action_item';
  created_at: string;
  created_by: string | null;
}

interface QuickNotesSidebarProps {
  candidateId: string;
  notes: Note[];
  onNotesUpdate: () => void;
}

const noteTypeIcons = {
  call: Phone,
  email: Mail,
  general: StickyNote,
  important: AlertCircle,
  action_item: CheckCircle,
};

const noteTypeLabels = {
  call: "Opkaldsnotat",
  email: "Email follow-up",
  general: "Generel observation",
  important: "Vigtig info",
  action_item: "Action item",
};

export const QuickNotesSidebar = ({ candidateId, notes, onNotesUpdate }: QuickNotesSidebarProps) => {
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState<Note['note_type']>("general");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      toast.error("Noter kan ikke være tomme");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("candidate_notes")
        .insert({
          candidate_id: candidateId,
          content: newNote.trim(),
          note_type: noteType,
          created_by: user?.id,
        });

      if (error) throw error;

      setNewNote("");
      setNoteType("general");
      toast.success("Note tilføjet");
      onNotesUpdate();
    } catch (error: any) {
      console.error("Error adding note:", error);
      toast.error("Kunne ikke tilføje note");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <StickyNote className="h-5 w-5" />
          Quick Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Add new note */}
        <div className="space-y-2 flex-shrink-0">
          <Select value={noteType} onValueChange={(value: any) => setNoteType(value)}>
            <SelectTrigger className="w-full bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {Object.entries(noteTypeLabels).map(([key, label]) => {
                const Icon = noteTypeIcons[key as keyof typeof noteTypeIcons];
                return (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {label}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          
          <Textarea
            placeholder="Tilføj en note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="min-h-[80px] resize-none"
          />
          
          <Button 
            onClick={handleAddNote} 
            disabled={isSubmitting || !newNote.trim()}
            className="w-full"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Tilføj note
          </Button>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {notes.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              Ingen noter endnu
            </div>
          ) : (
            notes.map((note) => {
              const Icon = noteTypeIcons[note.note_type];
              return (
                <div
                  key={note.id}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Icon className="h-3 w-3" />
                      {noteTypeLabels[note.note_type]}
                    </Badge>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(note.created_at), "d. MMM HH:mm", { locale: da })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};
