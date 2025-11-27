import { Phone, PhoneOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Call } from "@twilio/voice-sdk";

interface CallStatusDialogProps {
  candidateName: string;
  candidatePhone: string;
  call: Call | null;
  callSid?: string;
  applicationId?: string;
  onHangup: () => void;
}

export const CallStatusDialog = ({
  candidateName,
  candidatePhone,
  call,
  callSid,
  applicationId,
  onHangup,
}: CallStatusDialogProps) => {
  const [callDuration, setCallDuration] = useState(0);
  const [status, setStatus] = useState<"ringing" | "connected" | "disconnected">("ringing");
  const callStartTimeRef = useRef<Date | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!call) return;

    // Set start time when call is initiated
    callStartTimeRef.current = new Date();

    // Listen to call status changes
    const handleStatusChange = () => {
      const callStatus = call.status();
      console.log("Call status changed:", callStatus);

      if (callStatus === Call.State.Connected || callStatus === Call.State.Open) {
        setStatus("connected");
        // Start duration timer when connected
        durationIntervalRef.current = setInterval(() => {
          if (callStartTimeRef.current) {
            const elapsed = Math.floor((new Date().getTime() - callStartTimeRef.current.getTime()) / 1000);
            setCallDuration(elapsed);
          }
        }, 1000);
      } else if (callStatus === Call.State.Disconnected) {
        setStatus("disconnected");
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
        }
      }
    };

    // Set initial status
    handleStatusChange();

    // Add event listeners
    call.on("accept", handleStatusChange);
    call.on("disconnect", () => {
      handleStatusChange();
      // Log call when disconnected
      logCall();
    });
    call.on("cancel", () => {
      setStatus("disconnected");
      logCall();
    });
    call.on("reject", () => {
      setStatus("disconnected");
      logCall();
    });

    // Cleanup
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      call.off("accept", handleStatusChange);
      call.off("disconnect", handleStatusChange);
      call.off("cancel", handleStatusChange);
      call.off("reject", handleStatusChange);
    };
  }, [call]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const logCall = async () => {
    if (!applicationId) return;

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
  };

  const handleHangup = async () => {
    // Disconnect the call using Twilio Voice SDK
    if (call) {
      try {
        console.log("Disconnecting call");
        call.disconnect();
      } catch (error) {
        console.error("Error disconnecting call:", error);
      }
    }

    // Also try to hang up via API if we have callSid (fallback)
    if (callSid && !call) {
      try {
        console.log("Hanging up call via API:", callSid);
        await supabase.functions.invoke("hangup-call", {
          body: { callSid },
        });
      } catch (error) {
        console.error("Error hanging up call via API:", error);
      }
    }

    // Log call to database
    await logCall();

    // Clean up interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
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
              <p className="text-sm text-muted-foreground">{status === "ringing" ? "Ringer op..." : "Forbundet"}</p>
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

          {(callSid || call?.parameters()?.CallSid) && (
            <p className="text-xs text-center text-muted-foreground">
              Call ID: {(callSid || call?.parameters()?.CallSid || "").slice(0, 8)}...
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};
