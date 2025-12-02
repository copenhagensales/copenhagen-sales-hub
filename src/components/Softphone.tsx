import { useState, useEffect } from "react";
import { Phone, PhoneOff, Mic, MicOff, X, Bug, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Call } from "@twilio/voice-sdk";

interface IncomingCallCandidate {
  name: string;
  phone: string;
  role?: string;
  applicationId?: string;
}

interface TwilioManagerInterface {
  callStatus: string;
  currentCall: Call | null;
  incomingCallCandidate: IncomingCallCandidate | null;
  debugInfo: {
    tokenStatus: string;
    tokenLength: number;
    deviceStatus: string;
    lastError: string | null;
    lastErrorTime: Date | null;
  };
  makeCall: (phoneNumber: string) => Promise<void>;
  hangup: () => void;
  mute: () => void;
  unmute: () => void;
  isMuted: () => boolean;
  acceptIncomingCall: () => Promise<void>;
  rejectIncomingCall: () => Promise<void>;
  clearIncomingCallCandidate: () => void;
}

interface SoftphoneProps {
  userId: string;
  onClose: () => void;
  initialPhoneNumber?: string;
  twilioManager: TwilioManagerInterface;
}

export const Softphone = ({ userId, onClose, initialPhoneNumber, twilioManager }: SoftphoneProps) => {
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber || "");
  const [isMuted, setIsMuted] = useState(false);
  const [showDebug, setShowDebug] = useState(true);
  const [isTestingCredentials, setIsTestingCredentials] = useState(false);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);

  const { toast } = useToast();

  const {
    callStatus,
    currentCall,
    incomingCallCandidate,
    debugInfo,
    makeCall: twilioMakeCall,
    hangup,
    mute,
    unmute,
    acceptIncomingCall,
    rejectIncomingCall,
  } = twilioManager;

  // Track call start time
  useEffect(() => {
    if (callStatus === "active") {
      setCallStartTime(new Date());
    }
    if (callStatus === "disconnected") {
      setCallStartTime(null);
    }
  }, [callStatus]);

  // Auto-call when phone is ready and initialPhoneNumber is provided
  useEffect(() => {
    if (callStatus === "ready" && initialPhoneNumber && !currentCall) {
      console.log("Auto-calling initial phone number:", initialPhoneNumber);
      makeCall();
    }
  }, [callStatus, initialPhoneNumber]);

  const makeCall = async () => {
    if (!phoneNumber) return;
    await twilioMakeCall(phoneNumber);
  };

  const testCredentials = async () => {
    setIsTestingCredentials(true);
    try {
      toast({ description: "Testing Twilio credentials..." });

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${supabaseUrl}/functions/v1/twilio-voice-token`;

      console.log("[Test] Calling:", url);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("[Test] Response status:", response.status);

      if (!response.ok) {
        const responseText = await response.text();
        console.error("[Test] Failed:", responseText);
        toast({
          title: "Test failed",
          description: `HTTP ${response.status}`,
          variant: "destructive",
        });
        return;
      }

      const data = await response.json();

      if (data.token) {
        toast({
          title: "✓ Credentials verified",
          description: `Token generated (${data.token.length} chars)`,
        });
        console.log("[Test] Token received, length:", data.token.length);
      } else {
        toast({
          title: "Test failed",
          description: "No token in response",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("[Test] Error:", error);
      toast({
        title: "Test failed",
        description: error?.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsTestingCredentials(false);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      unmute();
    } else {
      mute();
    }
    setIsMuted(!isMuted);
  };

  const getStatusText = () => {
    switch (callStatus) {
      case "initializing":
        return "Initialiserer...";
      case "ready":
        return "Klar til opkald";
      case "connecting":
        return "Ringer...";
      case "active":
        return "I opkald";
      case "incoming":
        return "Indkommende opkald";
      case "disconnected":
        return "Afsluttet";
      case "error":
        return "Fejl";
      default:
        return callStatus;
    }
  };

  return (
    <Card className="fixed bottom-4 right-4 w-80 p-4 shadow-lg bg-background border z-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Softphone</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="text-sm text-muted-foreground text-center">{getStatusText()}</div>

        {/* Debug Panel */}
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="w-full px-3 py-2 bg-muted/50 flex items-center justify-between text-xs font-medium hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bug className="h-3 w-3" />
              Debug Info
            </div>
            {showDebug ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {showDebug && (
            <div className="p-3 space-y-2 text-xs bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Token:</span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      debugInfo.tokenStatus === "fetched"
                        ? "default"
                        : debugInfo.tokenStatus === "error"
                          ? "destructive"
                          : "secondary"
                    }
                    className="text-xs"
                  >
                    {debugInfo.tokenStatus}
                  </Badge>
                  {debugInfo.tokenLength > 0 && (
                    <span className="text-[10px] text-muted-foreground">{debugInfo.tokenLength} chars</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Device:</span>
                <Badge
                  variant={
                    debugInfo.deviceStatus === "registered"
                      ? "default"
                      : debugInfo.deviceStatus === "error"
                        ? "destructive"
                        : "secondary"
                  }
                  className="text-xs"
                >
                  {debugInfo.deviceStatus}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Call Status:</span>
                <Badge variant="outline" className="text-xs">
                  {callStatus}
                </Badge>
              </div>

              {debugInfo.lastError && (
                <div className="pt-2 border-t">
                  <div className="text-muted-foreground mb-1 font-medium">Seneste fejl:</div>
                  <div className="text-destructive break-words text-[10px] bg-destructive/10 p-2 rounded whitespace-pre-wrap font-mono">
                    {debugInfo.lastError}
                  </div>
                  {debugInfo.lastErrorTime && (
                    <div className="text-muted-foreground mt-1 text-[10px]">
                      {debugInfo.lastErrorTime.toLocaleTimeString("da-DK")}
                    </div>
                  )}
                </div>
              )}

              {!debugInfo.lastError && (
                <div className="pt-2 border-t">
                  <div className="text-muted-foreground text-[10px] text-center py-1">✓ Ingen fejl</div>
                </div>
              )}

              <div className="pt-2 border-t">
                <Button
                  onClick={testCredentials}
                  disabled={isTestingCredentials}
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {isTestingCredentials ? "Tester..." : "Test Credentials"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {callStatus === "incoming" && currentCall && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
            {incomingCallCandidate ? (
              <div className="space-y-2">
                <p className="text-lg font-semibold text-center">{incomingCallCandidate.name}</p>
                <p className="text-sm text-muted-foreground text-center">{incomingCallCandidate.phone}</p>
                {incomingCallCandidate.role && (
                  <Badge variant="outline" className="mx-auto block w-fit">
                    {incomingCallCandidate.role === "fieldmarketing" ? "Fieldmarketing" : "Salgskonsulent"}
                  </Badge>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-center">Fra: {currentCall.parameters.From}</p>
                <p className="text-xs text-muted-foreground text-center">Søger kandidat...</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={acceptIncomingCall} className="flex-1" variant="default">
                <Phone className="h-4 w-4 mr-2" />
                Besvar
              </Button>
              <Button onClick={rejectIncomingCall} className="flex-1" variant="destructive">
                <PhoneOff className="h-4 w-4 mr-2" />
                Afvis
              </Button>
            </div>
          </div>
        )}

        {(callStatus === "ready" || callStatus === "disconnected" || callStatus === "error") && (
          <div className="space-y-2">
            <Input
              type="tel"
              placeholder="Telefonnummer"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={callStatus !== "ready"}
            />
            <Button
              onClick={makeCall}
              className="w-full"
              disabled={!phoneNumber || callStatus !== "ready"}
              variant={callStatus === "error" ? "destructive" : "default"}
            >
              <Phone className="h-4 w-4 mr-2" />
              {callStatus === "error" ? "Fejl - Prøv igen" : "Ring op"}
            </Button>
          </div>
        )}

        {(callStatus === "connecting" || callStatus === "active") && (
          <div className="space-y-2">
            {phoneNumber && <p className="text-sm font-medium text-center">Til: {phoneNumber}</p>}
            <div className="flex gap-2">
              <Button onClick={toggleMute} variant="outline" size="sm" className="flex-1">
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button onClick={hangup} variant="destructive" size="sm" className="flex-1">
                <PhoneOff className="h-4 w-4 mr-2" />
                Læg på
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
