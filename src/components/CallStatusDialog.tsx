import { Phone, PhoneOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Twilio Voice SDK types
declare global {
  interface Window {
    Twilio?: any;
  }
}

interface CallStatusDialogProps {
  candidateName: string;
  candidatePhone: string;
  callSid?: string;
  applicationId?: string;
  onHangup: () => void;
}

export const CallStatusDialog = ({
  candidateName,
  candidatePhone,
  callSid,
  applicationId,
  onHangup,
}: CallStatusDialogProps) => {
  const [callDuration, setCallDuration] = useState(0);
  const [status, setStatus] = useState<"ringing" | "connected" | "disconnected">("ringing");
  const [actualCallSid, setActualCallSid] = useState<string>(callSid || "");
  const callRef = useRef<any>(null);
  const deviceRef = useRef<any>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const hasLoggedCallRef = useRef<boolean>(false);

  const logCall = useCallback(
    async (finalStatus: "connected" | "disconnected", finalDuration: number) => {
      if (hasLoggedCallRef.current || !applicationId) return;

      hasLoggedCallRef.current = true;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const outcome = finalStatus === "connected" ? "completed" : "ingen kontakt";
        const duration = finalStatus === "connected" ? finalDuration : null;

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
    },
    [applicationId, candidatePhone],
  );

  useEffect(() => {
    let durationInterval: ReturnType<typeof setInterval> | null = null;

    const initializeCall = async () => {
      try {
        // Get Twilio token
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke("twilio-token");

        if (tokenError || !tokenData?.token) {
          console.error("Failed to get Twilio token:", tokenError);
          setStatus("disconnected");
          await logCall("disconnected", 0);
          return;
        }

        // Load Twilio Voice SDK if not already loaded
        if (!window.Twilio) {
          const script = document.createElement("script");
          script.src = "https://sdk.twilio.com/js/client/releases/1.14.0/twilio.min.js";
          script.async = true;
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        // Initialize device
        const { Device } = window.Twilio!;
        deviceRef.current = new Device(tokenData.token, {
          logLevel: 1,
        });

        deviceRef.current.on("registered", () => {
          console.log("Twilio Device registered");
        });

        deviceRef.current.on("error", async (error: any) => {
          console.error("Twilio Device error:", error);
          setStatus("disconnected");
          await logCall("disconnected", 0);
        });

        // Make the call
        const call = deviceRef.current.connect({
          params: { To: candidatePhone },
        });

        callRef.current = call;
        setActualCallSid(call.parameters.CallSid || "");

        // Handle call events
        call.on("accept", () => {
          console.log("Call accepted");
          callStartTimeRef.current = Date.now();
          setStatus("connected");
        });

        call.on("disconnect", async () => {
          console.log("Call disconnected");
          const duration = callStartTimeRef.current ? Math.floor((Date.now() - callStartTimeRef.current) / 1000) : 0;
          setStatus("disconnected");
          await logCall("connected", duration);
        });

        call.on("cancel", async () => {
          console.log("Call cancelled");
          setStatus("disconnected");
          await logCall("disconnected", 0);
        });

        call.on("reject", async () => {
          console.log("Call rejected");
          setStatus("disconnected");
          await logCall("disconnected", 0);
        });

        call.on("error", async (error: any) => {
          console.error("Call error:", error);
          setStatus("disconnected");
          await logCall("disconnected", 0);
        });

        // Set status to ringing
        setStatus("ringing");
      } catch (error) {
        console.error("Error initializing call:", error);
        setStatus("disconnected");
        await logCall("disconnected", 0);
      }
    };

    initializeCall();

    return () => {
      if (durationInterval) clearInterval(durationInterval);
      if (callRef.current) {
        callRef.current.disconnect();
      }
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }
    };
  }, [candidatePhone, logCall]);

  // Update call duration when connected
  useEffect(() => {
    if (status === "connected" && callStartTimeRef.current) {
      const interval = setInterval(() => {
        if (callStartTimeRef.current) {
          const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
          setCallDuration(elapsed);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleHangup = async () => {
    // Disconnect the call
    if (callRef.current) {
      callRef.current.disconnect();
    }

    // Clean up device
    if (deviceRef.current) {
      deviceRef.current.destroy();
    }

    // Log call if not already logged
    const finalDuration = callStartTimeRef.current
      ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
      : callDuration;
    await logCall(status === "connected" ? "connected" : "disconnected", finalDuration);

    setStatus("disconnected");
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

          {(actualCallSid || callSid) && (
            <p className="text-xs text-center text-muted-foreground">
              Call ID: {(actualCallSid || callSid)?.slice(0, 8)}...
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};
