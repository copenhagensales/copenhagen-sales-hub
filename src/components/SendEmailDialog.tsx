import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Clock } from "lucide-react";
import { addHours, addWeeks, format } from "date-fns";
import { da } from "date-fns/locale";

interface EmailTemplate {
  id: string;
  name: string;
  template_key: string;
  subject: string;
  content: string;
}

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateEmail: string;
  candidateName: string;
  applicationId: string;
  onEmailSent?: () => void;
  initialSubject?: string;
  initialBody?: string;
  replyToMessageId?: string;
}

export const SendEmailDialog = ({
  open,
  onOpenChange,
  candidateEmail,
  candidateName,
  applicationId,
  onEmailSent,
  initialSubject = "",
  initialBody = "",
  replyToMessageId,
}: SendEmailDialogProps) => {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [isSending, setIsSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [applicationRole, setApplicationRole] = useState<string>("");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [scheduleDelay, setScheduleDelay] = useState<string>("now");

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from("email_templates")
        .select("*")
        .order("name");
      
      if (data) {
        setTemplates(data);
      }
    };

    if (open) {
      fetchTemplates();
      // Set initial content if provided
      if (initialSubject) {
        setSubject(initialSubject);
      }
      if (initialBody) {
        setBody(initialBody);
      }
      // Reset schedule delay
      setScheduleDelay("now");
    }
  }, [open, initialSubject, initialBody]);

  useEffect(() => {
    const fetchApplicationRole = async () => {
      const { data } = await supabase
        .from("applications")
        .select("role")
        .eq("id", applicationId)
        .single();
      
      if (data) {
        setApplicationRole(data.role);
      }
    };

    if (open && applicationId) {
      fetchApplicationRole();
    }
  }, [open, applicationId]);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const firstName = candidateName.split(" ")[0];
      const populatedSubject = template.subject
        .replace(/{{fornavn}}/g, firstName)
        .replace(/{{rolle}}/g, applicationRole || "salgskonsulent");
      const populatedBody = template.content
        .replace(/{{fornavn}}/g, firstName)
        .replace(/{{rolle}}/g, applicationRole || "salgskonsulent");
      setSubject(populatedSubject);
      setBody(populatedBody);
    }
  };

  const getScheduledDateTime = (): string | undefined => {
    if (scheduleDelay === "now") return undefined;
    
    const now = new Date();
    let scheduledDate: Date;
    
    switch (scheduleDelay) {
      case "24h":
        scheduledDate = addHours(now, 24);
        break;
      case "48h":
        scheduledDate = addHours(now, 48);
        break;
      case "72h":
        scheduledDate = addHours(now, 72);
        break;
      case "1w":
        scheduledDate = addWeeks(now, 1);
        break;
      default:
        return undefined;
    }
    
    return scheduledDate.toISOString();
  };

  const getScheduleLabel = (): string => {
    if (scheduleDelay === "now") return "Send nu";
    
    const scheduledDateTime = getScheduledDateTime();
    if (!scheduledDateTime) return "Send nu";
    
    return `Sendes ${format(new Date(scheduledDateTime), "EEEE 'd.' d. MMMM 'kl.' HH:mm", { locale: da })}`;
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Emne og besked er påkrævet");
      return;
    }

    setIsSending(true);
    try {
      const scheduledDateTime = getScheduledDateTime();
      
      const emailData: any = {
        to: candidateEmail,
        subject: subject.trim(),
        body: body.trim().replace(/\n/g, '<br>'),
      };

      if (replyToMessageId) {
        emailData.inReplyTo = replyToMessageId;
      }

      if (scheduledDateTime) {
        emailData.scheduledDateTime = scheduledDateTime;
      }

      const { data, error } = await supabase.functions.invoke("send-email", {
        body: emailData,
      });

      if (error) throw error;

      // Log email to communication_logs
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from("communication_logs").insert({
        application_id: applicationId,
        type: "email",
        direction: "outbound",
        content: subject.trim(),
        outcome: body.trim(),
        created_by: user?.id,
      });

      if (scheduledDateTime) {
        toast.success(`Email planlagt til ${format(new Date(scheduledDateTime), "d. MMM 'kl.' HH:mm", { locale: da })}`);
      } else {
        toast.success("Email sendt til " + candidateName);
      }
      setSubject("");
      setBody("");
      setScheduleDelay("now");
      onOpenChange(false);
      onEmailSent?.();
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Kunne ikke sende email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Send Email til {candidateName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Til: {candidateEmail}</label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">Vælg skabelon</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger id="template">
                <SelectValue placeholder="Vælg en email-skabelon..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="subject">Emne</Label>
            <Input
              id="subject"
              placeholder="Skriv emne..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Besked</Label>
            <Textarea
              id="body"
              placeholder="Skriv din besked..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule">Udsæt afsendelse</Label>
            <Select value={scheduleDelay} onValueChange={setScheduleDelay}>
              <SelectTrigger id="schedule">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="now">Send nu</SelectItem>
                <SelectItem value="24h">24 timer</SelectItem>
                <SelectItem value="48h">48 timer</SelectItem>
                <SelectItem value="72h">72 timer</SelectItem>
                <SelectItem value="1w">1 uge</SelectItem>
              </SelectContent>
            </Select>
            {scheduleDelay !== "now" && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {getScheduleLabel()}
              </p>
            )}
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSending}
            >
              Annuller
            </Button>
            <Button onClick={handleSend} disabled={isSending || !subject.trim() || !body.trim()}>
              {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {scheduleDelay === "now" ? "Send Email" : "Planlæg Email"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
