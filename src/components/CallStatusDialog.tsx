import React, { useEffect, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Call } from "@twilio/voice-sdk";

interface CallStatusDialogProps {
  candidateName: string;
  candidatePhone: string;
  callSid?: string;
  applicationId?: string;
  activeCall?: Call | null;
  onHangup: () => void;
}

export const CallStatusDialog = ({
  candidateName,
  candidatePhone,
  callSid,
  applicationId,
  activeCall,
  onHangup,
}: CallStatusDialogProps) => {
  const [callDuration, setCallDuration] = useState(0);
  const [status, setStatus] = useState<"ringing" | "connected" | "disconnected">("ringing");
  const [callStartTime] = useState(new Date());

  useEffect(() => {
    if (!activeCall) return;

    const handleAccept = () => {
      console.log("Call accepted");
      setStatus("connected");
    };

    const handleDisconnect = () => {
      console.log("Call disconnected");
      setStatus("disconnected");
    };

    const handleCancel = () => {
      console.log("Call cancelled");
      setStatus("disconnected");
    };

    const handleError = (error: any) => {
      console.error("Call error:", error);
      setStatus("disconnected");
    };

    activeCall.on("accept", handleAccept);
    activeCall.on("disconnect", handleDisconnect);
    activeCall.on("cancel", handleCancel);
    activeCall.on("error", handleError);

    // Check if call is already connected
    if (activeCall.status() === "open") {
      setStatus("connected");
    }

    return () => {
      activeCall.off("accept", handleAccept);
      activeCall.off("disconnect", handleDisconnect);
      activeCall.off("cancel", handleCancel);
      activeCall.off("error", handleError);
    };
  }, [activeCall]);

  useEffect(() => {
    if (status === "connected") {
      const interval = setInterval(() => {
        const elapsed = Math.floor((new Date().getTime() - callStartTime.getTime()) / 1000);
        setCallDuration(elapsed);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status, callStartTime]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleHangup = async () => {
    // Disconnect the call if it's active
    if (activeCall) {
      try {
        activeCall.disconnect();
      } catch (error) {
        console.error("Error disconnecting call:", error);
      }
    }

    // Log call to database if we have an applicationId
    if (applicationId) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // Determine outcome based on call status
        const outcome = status === "connected" ? "completed" : "ingen kontakt";
        const duration = status === "connected" ? callDuration : null;

        await supabase.from("communication_logs").insert({
          application_id: applicationId,
          type: "phone",
          direction: "outbound",
          duration: duration,
          outcome: outcome,
          content: `Opkald til ${candidatePhone}`,
          created_by: user?.id,
        });

        console.log("Call logged successfully with outcome:", outcome);
      } catch (error) {
        console.error("Error logging call:", error);
      }
    }

    onHangup();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6 shadow-2xl">
        <div className="space-y-6">
          {/* Status indicator */}
          <div className="flex flex-col items-center gap-4">
            <div
              className={`
              w-20 h-20 rounded-full flex items-center justify-center
              ${status === "ringing" ? "bg-status-progress/20 animate-pulse" : "bg-status-success/20"}
            `}
            >
              <Phone
                className={`
                h-10 w-10
                ${status === "ringing" ? "text-status-progress" : "text-status-success"}
              `}
              />
            </div>

            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">
                {status === "ringing" ? "Ringer op..." : status === "connected" ? "Forbundet" : "Afsluttet"}
              </p>
              <h3 className="text-xl font-semibold">{candidateName}</h3>
              <p className="text-sm text-muted-foreground">{candidatePhone}</p>
            </div>
          </div>

          {/* Call duration */}
          {status === "connected" && (
            <div className="text-center">
              <p className="text-3xl font-mono font-semibold tabular-nums">{formatDuration(callDuration)}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-center">
            <Button onClick={handleHangup} variant="destructive" size="lg" className="rounded-full w-16 h-16">
              <PhoneOff className="h-6 w-6" />
            </Button>
          </div>

          {callSid && <p className="text-xs text-center text-muted-foreground">Call ID: {callSid.slice(0, 8)}...</p>}
        </div>
      </Card>
    </div>
  );
};
