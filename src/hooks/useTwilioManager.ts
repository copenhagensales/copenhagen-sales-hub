import { useState, useEffect, useCallback, useRef } from "react";
import { TwilioVoiceManager } from "@/utils/TwilioVoice";
import { supabase } from "@/integrations/supabase/client";
import { Call } from "@twilio/voice-sdk";
import { useToast } from "@/hooks/use-toast";

interface IncomingCallCandidate {
  name: string;
  phone: string;
  role?: string;
  applicationId?: string;
}

interface UseTwilioManagerProps {
  userId: string;
  onIncomingCall?: () => void;
}

export const useTwilioManager = ({ userId, onIncomingCall }: UseTwilioManagerProps) => {
  const [callStatus, setCallStatus] = useState<string>("initializing");
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [incomingCallCandidate, setIncomingCallCandidate] = useState<IncomingCallCandidate | null>(null);
  const [debugInfo, setDebugInfo] = useState({
    tokenStatus: "not_fetched",
    tokenLength: 0,
    deviceStatus: "not_created",
    lastError: null as string | null,
    lastErrorTime: null as Date | null,
  });
  
  const twilioManagerRef = useRef<TwilioVoiceManager | null>(null);
  const { toast } = useToast();

  const lookupCandidate = useCallback(async (phoneNumber: string) => {
    try {
      console.log("Looking up candidate for phone:", phoneNumber);
      const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");

      const { data: candidates, error: candidateError } = await supabase
        .from("candidates")
        .select("id, first_name, last_name, phone")
        .ilike("phone", `%${cleanNumber.slice(-8)}%`)
        .limit(1);

      if (candidateError) {
        console.error("Error looking up candidate:", candidateError);
        return;
      }

      let candidateInfo: IncomingCallCandidate;

      if (candidates && candidates.length > 0) {
        const candidate = candidates[0];
        const { data: applications } = await supabase
          .from("applications")
          .select("id, role")
          .eq("candidate_id", candidate.id)
          .order("created_at", { ascending: false })
          .limit(1);

        const application = applications?.[0];
        candidateInfo = {
          name: `${candidate.first_name} ${candidate.last_name}`,
          phone: phoneNumber,
          role: application?.role,
          applicationId: application?.id,
        };

        toast({
          title: "📞 Indgående opkald",
          description: `${candidate.first_name} ${candidate.last_name} ringer`,
          duration: 30000,
        });

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("📞 Indgående opkald", {
            body: `${candidate.first_name} ${candidate.last_name} ringer`,
            icon: "/favicon.ico",
            requireInteraction: true,
          });
        } else if ("Notification" in window && Notification.permission !== "denied") {
          Notification.requestPermission();
        }
      } else {
        candidateInfo = {
          name: "Ukendt nummer",
          phone: phoneNumber,
        };

        toast({
          title: "📞 Indgående opkald",
          description: `Fra ${phoneNumber}`,
          duration: 30000,
        });

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("📞 Indgående opkald", {
            body: `Fra ${phoneNumber}`,
            icon: "/favicon.ico",
            requireInteraction: true,
          });
        }
      }

      setIncomingCallCandidate(candidateInfo);
    } catch (error) {
      console.error("Error in lookupCandidate:", error);
    }
  }, [toast]);

  useEffect(() => {
    if (!userId) return;

    const initializeTwilio = async () => {
      try {
        console.log("=== Initializing Twilio Manager (Global) ===");
        setDebugInfo((prev) => ({ ...prev, tokenStatus: "fetching" }));

        const manager = new TwilioVoiceManager(
          userId,
          (status, call) => {
            console.log("Call status changed:", status);
            setCallStatus(status);

            if (status === "ready") {
              setDebugInfo((prev) => ({ ...prev, deviceStatus: "registered" }));
            } else if (status === "error") {
              setDebugInfo((prev) => ({
                ...prev,
                deviceStatus: "error",
                lastError: "Device error occurred",
                lastErrorTime: new Date(),
              }));
            }

            if (call) {
              setCurrentCall(call);

              if (status === "incoming") {
                const fromNumber = call.parameters.From;
                lookupCandidate(fromNumber);
                // Auto-open softphone on incoming call
                onIncomingCall?.();
              }
            }

            if (status === "disconnected") {
              setCurrentCall(null);
              setIncomingCallCandidate(null);
            }
          },
          (debugUpdate) => {
            if (debugUpdate.tokenLength !== undefined) {
              setDebugInfo((prev) => ({ ...prev, tokenLength: debugUpdate.tokenLength }));
            }
            if (debugUpdate.deviceError) {
              setDebugInfo((prev) => ({
                ...prev,
                deviceStatus: "error",
                lastError: debugUpdate.deviceError,
                lastErrorTime: new Date(),
              }));
            }
          }
        );

        setDebugInfo((prev) => ({ ...prev, deviceStatus: "creating" }));
        await manager.initialize();
        console.log("Twilio Manager initialized successfully");
        twilioManagerRef.current = manager;

        setDebugInfo((prev) => ({
          ...prev,
          tokenStatus: "fetched",
          deviceStatus: "created",
        }));
      } catch (error) {
        console.error("[TwilioManager] Error:", error);
        const errorMsg = error instanceof Error ? error.message : "Ukendt fejl";
        setDebugInfo((prev) => ({
          ...prev,
          tokenStatus: "error",
          deviceStatus: "error",
          lastError: errorMsg,
          lastErrorTime: new Date(),
        }));
        setCallStatus("error");
      }
    };

    initializeTwilio();

    return () => {
      console.log("Cleaning up Twilio manager");
      twilioManagerRef.current?.destroy();
      twilioManagerRef.current = null;
    };
  }, [userId, lookupCandidate, onIncomingCall]);

  // Reset status after disconnect
  useEffect(() => {
    if (callStatus === "disconnected" || callStatus === "error") {
      const timer = setTimeout(() => {
        setCallStatus("ready");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [callStatus]);

  const makeCall = useCallback(async (phoneNumber: string) => {
    if (!twilioManagerRef.current || !phoneNumber) return;
    try {
      await twilioManagerRef.current.makeCall(phoneNumber);
      toast({
        title: "Ringer op",
        description: `Ringer til ${phoneNumber}`,
      });
    } catch (error) {
      console.error("Error making call:", error);
      toast({
        title: "Fejl",
        description: "Kunne ikke ringe op",
        variant: "destructive",
      });
    }
  }, [toast]);

  const hangup = useCallback(() => {
    twilioManagerRef.current?.hangup();
  }, []);

  const mute = useCallback(() => {
    twilioManagerRef.current?.mute();
  }, []);

  const unmute = useCallback(() => {
    twilioManagerRef.current?.unmute();
  }, []);

  const acceptIncomingCall = useCallback(async () => {
    twilioManagerRef.current?.acceptIncomingCall();

    if (incomingCallCandidate?.applicationId) {
      try {
        await supabase.from("communication_logs").insert({
          application_id: incomingCallCandidate.applicationId,
          type: "call",
          direction: "inbound",
          outcome: "besvaret",
          content: `Indgående opkald fra ${incomingCallCandidate.name}`,
          created_by: userId,
        });
      } catch (error) {
        console.error("Error logging accepted call:", error);
      }
    }
  }, [incomingCallCandidate, userId]);

  const rejectIncomingCall = useCallback(async () => {
    twilioManagerRef.current?.rejectIncomingCall();

    if (incomingCallCandidate?.applicationId) {
      try {
        await supabase.from("communication_logs").insert({
          application_id: incomingCallCandidate.applicationId,
          type: "call",
          direction: "inbound",
          outcome: "afvist",
          content: `Indgående opkald fra ${incomingCallCandidate.name} - afvist`,
          created_by: userId,
        });
      } catch (error) {
        console.error("Error logging rejected call:", error);
      }
    }

    setIncomingCallCandidate(null);
  }, [incomingCallCandidate, userId]);

  const isMuted = useCallback(() => {
    return twilioManagerRef.current?.isMuted() ?? false;
  }, []);

  return {
    callStatus,
    currentCall,
    incomingCallCandidate,
    debugInfo,
    makeCall,
    hangup,
    mute,
    unmute,
    isMuted,
    acceptIncomingCall,
    rejectIncomingCall,
    clearIncomingCallCandidate: () => setIncomingCallCandidate(null),
  };
};
