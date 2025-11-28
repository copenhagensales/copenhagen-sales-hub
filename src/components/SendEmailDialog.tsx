import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Emne og besked er påkrævet");
      return;
    }

    setIsSending(true);
    try {
      const emailData: any = {
        to: candidateEmail,
        subject: subject.trim(),
        body: body.trim().replace(/\n/g, '<br>'),
      };

      if (replyToMessageId) {
        emailData.inReplyTo = replyToMessageId;
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

      toast.success("Email sendt til " + candidateName);
      setSubject("");
      setBody("");
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
              Send Email
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
