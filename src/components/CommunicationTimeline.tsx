import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Phone, Mail, MessageSquare, StickyNote, AlertCircle, CheckCircle, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Communication {
  id: string;
  type: string;
  direction: string;
  content?: string;
  outcome?: string;
  duration?: number;
  created_at: string;
}

interface Note {
  id: string;
  content: string;
  note_type: string;
  created_at: string;
}

interface TimelineItem {
  id: string;
  type: 'communication' | 'note';
  created_at: string;
  data: Communication | Note;
}

interface CommunicationTimelineProps {
  communications: Communication[];
  notes: Note[];
}

const noteTypeIcons = {
  call: Phone,
  email: Mail,
  general: StickyNote,
  important: AlertCircle,
  action_item: CheckCircle,
};

export const CommunicationTimeline = ({ communications, notes }: CommunicationTimelineProps) => {
  const [filter, setFilter] = useState<string>("all");

  // Combine and sort all timeline items
  const timelineItems: TimelineItem[] = [
    ...communications.map(comm => ({
      id: comm.id,
      type: 'communication' as const,
      created_at: comm.created_at,
      data: comm,
    })),
    ...notes.map(note => ({
      id: note.id,
      type: 'note' as const,
      created_at: note.created_at,
      data: note,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Apply filter
  const filteredItems = timelineItems.filter(item => {
    if (filter === "all") return true;
    if (filter === "notes") return item.type === "note";
    if (filter === "calls") return item.type === "communication" && (item.data as Communication).type === "phone";
    if (filter === "emails") return item.type === "communication" && (item.data as Communication).type === "email";
    if (filter === "sms") return item.type === "communication" && (item.data as Communication).type === "sms";
    return true;
  });

  const getIcon = (item: TimelineItem) => {
    if (item.type === "note") {
      const note = item.data as Note;
      return noteTypeIcons[note.note_type as keyof typeof noteTypeIcons] || StickyNote;
    }
    const comm = item.data as Communication;
    if (comm.type === "phone") return Phone;
    if (comm.type === "email") return Mail;
    if (comm.type === "sms") return MessageSquare;
    return StickyNote;
  };

  const getTypeLabel = (item: TimelineItem) => {
    if (item.type === "note") {
      const note = item.data as Note;
      const labels: Record<string, string> = {
        call: "Opkaldsnotat",
        email: "Email follow-up",
        general: "Note",
        important: "Vigtig",
        action_item: "Action item",
      };
      return labels[note.note_type] || "Note";
    }
    const comm = item.data as Communication;
    if (comm.type === "phone") return "Opkald";
    if (comm.type === "email") return "Email";
    if (comm.type === "sms") return "SMS";
    return "Kommunikation";
  };

  const getContent = (item: TimelineItem) => {
    if (item.type === "note") {
      const note = item.data as Note;
      return note.content;
    }
    const comm = item.data as Communication;
    if (comm.type === "phone") {
      return `${comm.direction === "outbound" ? "Udgående" : "Indgående"} opkald • ${comm.outcome || "Ingen resultat"} ${comm.duration ? `• ${comm.duration}s` : ""}`;
    }
    return comm.content || "Ingen indhold";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Kommunikations-timeline</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Filtrer..." />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">Vis alt</SelectItem>
              <SelectItem value="notes">Kun noter</SelectItem>
              <SelectItem value="calls">Kun opkald</SelectItem>
              <SelectItem value="emails">Kun emails</SelectItem>
              <SelectItem value="sms">Kun SMS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filteredItems.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Ingen aktivitet fundet
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item, index) => {
              const Icon = getIcon(item);
              return (
                <div key={item.id} className="relative">
                  {/* Timeline line */}
                  {index < filteredItems.length - 1 && (
                    <div className="absolute left-4 top-10 bottom-0 w-px bg-border" />
                  )}
                  
                  {/* Timeline item */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center relative z-10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {getTypeLabel(item)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.created_at), "d. MMMM yyyy 'kl.' HH:mm", { locale: da })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{getContent(item)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
