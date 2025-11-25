import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface SendSmsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidatePhone: string;
  candidateName: string;
  applicationId: string;
  onSmsSent?: () => void;
}

export const SendSmsDialog = ({
  open,
  onOpenChange,
  candidatePhone,
  candidateName,
  applicationId,
  onSmsSent,
}: SendSmsDialogProps) => {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

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
          <Textarea
            placeholder="Skriv din besked..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="resize-none"
          />
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
