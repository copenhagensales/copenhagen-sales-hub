import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface SmsTemplate {
  id: string;
  name: string;
  template_key: string;
  content: string;
}

interface SendSmsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidatePhone: string;
  candidateName: string;
  applicationId: string;
  onSmsSent?: () => void;
  initialMessage?: string;
}

export const SendSmsDialog = ({
  open,
  onOpenChange,
  candidatePhone,
  candidateName,
  applicationId,
  onSmsSent,
  initialMessage,
}: SendSmsDialogProps) => {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [applicationRole, setApplicationRole] = useState<string>("");
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from("sms_templates")
        .select("*")
        .order("name");
      
      if (data) {
        setTemplates(data);
      }
    };

    if (open) {
      fetchTemplates();
      // Set initial message if provided
      if (initialMessage) {
        setMessage(initialMessage);
      }
    }
  }, [open, initialMessage]);

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
      const populatedMessage = template.content
        .replace(/{{fornavn}}/g, firstName)
        .replace(/{{rolle}}/g, applicationRole || "salgskonsulent");
      setMessage(populatedMessage);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Besked er påkrævet");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: { to: candidatePhone, message: message.trim() },
      });

      if (error) throw error;

      // Log SMS to communication_logs
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from("communication_logs").insert({
        application_id: applicationId,
        type: "sms",
        direction: "outbound",
        content: message.trim(),
        outcome: "sent",
        created_by: user?.id,
      });

      toast.success("SMS sendt til " + candidateName);
      setMessage("");
      onOpenChange(false);
      onSmsSent?.();
    } catch (error) {
      console.error("Error sending SMS:", error);
      toast.error("Kunne ikke sende SMS");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send SMS til {candidateName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Til: {candidatePhone}</label>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="template">Vælg skabelon</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger id="template">
                <SelectValue placeholder="Vælg en SMS-skabelon..." />
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
            <Label htmlFor="message">Besked</Label>
            <Textarea
              id="message"
              placeholder="Skriv din besked..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>
          
          <div className="text-sm text-muted-foreground text-right">
            {message.length} tegn
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSending}
            >
              Annuller
            </Button>
            <Button onClick={handleSend} disabled={isSending || !message.trim()}>
              {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send SMS
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
