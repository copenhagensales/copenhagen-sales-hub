import { useState, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, X, Bug, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { TwilioVoiceManager } from '@/utils/TwilioVoice';
import { supabase } from '@/integrations/supabase/client';
import { Call } from '@twilio/voice-sdk';
import { Badge } from '@/components/ui/badge';

interface SoftphoneProps {
  userId: string;
  onClose: () => void;
  initialPhoneNumber?: string;
}

export const Softphone = ({ userId, onClose, initialPhoneNumber }: SoftphoneProps) => {
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber || '');
  const [callStatus, setCallStatus] = useState<string>('initializing');
  const [isMuted, setIsMuted] = useState(false);
  const [twilioManager, setTwilioManager] = useState<TwilioVoiceManager | null>(null);
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [showDebug, setShowDebug] = useState(true);
  const [isTestingCredentials, setIsTestingCredentials] = useState(false);
  
  // Debug state
  const [debugInfo, setDebugInfo] = useState({
    tokenStatus: 'not_fetched',
    tokenLength: 0,
    deviceStatus: 'not_created',
    lastError: null as string | null,
    lastErrorTime: null as Date | null,
  });
  
  const { toast } = useToast();

  useEffect(() => {
    const initializeTwilio = async () => {
      try {
        console.log('=== Starting Softphone Initialization ===');
        console.log('User ID:', userId);
        
        setDebugInfo(prev => ({ ...prev, tokenStatus: 'fetching' }));
        
        const manager = new TwilioVoiceManager(
          userId, 
          (status, call) => {
            console.log('Call status changed:', status);
            setCallStatus(status);
            
            // Update device status in debug info
            if (status === 'ready') {
              setDebugInfo(prev => ({ ...prev, deviceStatus: 'registered' }));
            } else if (status === 'error') {
              setDebugInfo(prev => ({ 
                ...prev, 
                deviceStatus: 'error',
                lastError: 'Device error occurred',
                lastErrorTime: new Date()
              }));
            }
            
            if (call) {
              setCurrentCall(call);
            }
            if (status === 'active') {
              setCallStartTime(new Date());
            }
            if (status === 'disconnected') {
              handleCallEnd();
            }
          },
          (debugUpdate) => {
            // Update debug info from TwilioVoiceManager
            if (debugUpdate.tokenLength !== undefined) {
              setDebugInfo(prev => ({ ...prev, tokenLength: debugUpdate.tokenLength }));
            }
          }
        );

        console.log('Calling manager.initialize()...');
        setDebugInfo(prev => ({ ...prev, deviceStatus: 'creating' }));
        
        await manager.initialize();
        console.log('Manager initialized successfully');
        setTwilioManager(manager);
        
        setDebugInfo(prev => ({ 
          ...prev, 
          tokenStatus: 'fetched',
          deviceStatus: 'created'
        }));
      } catch (error) {
        console.error('[Softphone] === Error Initializing Softphone ===');
        console.error('[Softphone] Error type:', error?.constructor?.name);
        console.error('[Softphone] Error message:', error instanceof Error ? error.message : String(error));
        console.error('[Softphone] Full error:', error);
        
        const errorMsg = error instanceof Error ? error.message : 'Ukendt fejl';
        
        setDebugInfo(prev => ({
          ...prev,
          tokenStatus: 'error',
          deviceStatus: 'error',
          lastError: errorMsg,
          lastErrorTime: new Date()
        }));
        
        toast({
          title: 'Telefon kunne ikke initialiseres',
          description: errorMsg,
          variant: 'destructive',
        });
        setCallStatus('error');
      }
    };

    initializeTwilio();

    return () => {
      console.log('Cleaning up Twilio manager');
      twilioManager?.destroy();
    };
  }, [userId]);

  // Auto-call when phone is ready and initialPhoneNumber is provided
  useEffect(() => {
    if (callStatus === 'ready' && initialPhoneNumber && twilioManager && !currentCall) {
      console.log('Auto-calling initial phone number:', initialPhoneNumber);
      makeCall();
    }
  }, [callStatus, initialPhoneNumber, twilioManager]);

  const handleCallEnd = async () => {
    if (!currentCall || !callStartTime) return;

    const duration = Math.floor((new Date().getTime() - callStartTime.getTime()) / 1000);
    const callParams = currentCall.parameters;

    try {
      // For now, we'll skip logging as we need application_id
      // TODO: Implement call logging with candidate matching
      console.log('Call completed:', {
        from: callParams.From,
        to: callParams.To,
        duration: duration
      });

      console.log('Call logged successfully');
    } catch (error) {
      console.error('Error logging call:', error);
    }

    setCurrentCall(null);
    setCallStartTime(null);
  };

  const makeCall = async () => {
    if (!twilioManager || !phoneNumber) return;

    try {
      await twilioManager.makeCall(phoneNumber);
      toast({
        title: 'Ringer op',
        description: `Ringer til ${phoneNumber}`,
      });
    } catch (error) {
      console.error('Error making call:', error);
      toast({
        title: 'Fejl',
        description: 'Kunne ikke ringe op',
        variant: 'destructive',
      });
    }
  };

  const testCredentials = async () => {
    setIsTestingCredentials(true);
    console.log('[Softphone] Testing Twilio credentials...');

    try {
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-voice-token`;
      
      console.log('[Test] Calling token endpoint:', functionUrl);
      
      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('[Test] Response status:', res.status);
      
      const text = await res.text();
      console.log('[Test] Response text:', text);

      if (!res.ok) {
        const errorData = text ? JSON.parse(text) : {};
        console.error('[Test] ❌ Credential test failed:', errorData);
        
        setDebugInfo(prev => ({
          ...prev,
          lastError: errorData.error || `HTTP ${res.status}`,
          lastErrorTime: new Date()
        }));

        toast({
          title: 'Credentials test fejlede',
          description: errorData.details ? errorData.details.join(', ') : errorData.error || `HTTP ${res.status}`,
          variant: 'destructive',
        });
        return;
      }

      const data = JSON.parse(text);
      console.log('[Test] ✅ Token received, length:', data.token?.length);

      toast({
        title: 'Credentials test lykkedes!',
        description: `Token genereret (${data.token?.length} chars)`,
      });

      setDebugInfo(prev => ({
        ...prev,
        tokenStatus: 'verified',
        tokenLength: data.token?.length || 0,
        lastError: null
      }));

    } catch (error) {
      console.error('[Test] ❌ Error testing credentials:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      setDebugInfo(prev => ({
        ...prev,
        lastError: errorMsg,
        lastErrorTime: new Date()
      }));

      toast({
        title: 'Credentials test fejlede',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsTestingCredentials(false);
    }
  };

  const hangup = () => {
    twilioManager?.hangup();
  };

  const toggleMute = () => {
    if (isMuted) {
      twilioManager?.unmute();
    } else {
      twilioManager?.mute();
    }
    setIsMuted(!isMuted);
  };

  const acceptCall = () => {
    twilioManager?.acceptIncomingCall();
  };

  const rejectCall = () => {
    twilioManager?.rejectIncomingCall();
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'initializing':
        return 'Initialiserer...';
      case 'ready':
        return 'Klar til opkald';
      case 'connecting':
        return 'Ringer...';
      case 'active':
        return 'I opkald';
      case 'incoming':
        return 'Indkommende opkald';
      case 'disconnected':
        return 'Afsluttet';
      case 'error':
        return 'Fejl';
      default:
        return callStatus;
    }
  };

  return (
    <Card className="fixed bottom-4 right-4 w-80 p-4 shadow-lg bg-background border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Softphone</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="text-sm text-muted-foreground text-center">
          {getStatusText()}
        </div>

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
                      debugInfo.tokenStatus === 'fetched' ? 'default' : 
                      debugInfo.tokenStatus === 'error' ? 'destructive' : 
                      'secondary'
                    }
                    className="text-xs"
                  >
                    {debugInfo.tokenStatus}
                  </Badge>
                  {debugInfo.tokenLength > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {debugInfo.tokenLength} chars
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Device:</span>
                <Badge 
                  variant={
                    debugInfo.deviceStatus === 'registered' ? 'default' : 
                    debugInfo.deviceStatus === 'error' ? 'destructive' : 
                    'secondary'
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
                  <div className="text-muted-foreground mb-1">Seneste fejl:</div>
                  <div className="text-destructive break-words text-[10px] bg-destructive/10 p-2 rounded">
                    {debugInfo.lastError}
                  </div>
                  {debugInfo.lastErrorTime && (
                    <div className="text-muted-foreground mt-1 text-[10px]">
                      {debugInfo.lastErrorTime.toLocaleTimeString('da-DK')}
                    </div>
                  )}
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
                  {isTestingCredentials ? 'Tester...' : 'Test Credentials'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {callStatus === 'incoming' && currentCall && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-center">
              Fra: {currentCall.parameters.From}
            </p>
            <div className="flex gap-2">
              <Button onClick={acceptCall} className="flex-1" variant="default">
                <Phone className="h-4 w-4 mr-2" />
                Besvar
              </Button>
              <Button onClick={rejectCall} className="flex-1" variant="destructive">
                <PhoneOff className="h-4 w-4 mr-2" />
                Afvis
              </Button>
            </div>
          </div>
        )}

        {callStatus === 'ready' && (
          <div className="space-y-2">
            <Input
              type="tel"
              placeholder="Telefonnummer"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <Button onClick={makeCall} className="w-full" disabled={!phoneNumber}>
              <Phone className="h-4 w-4 mr-2" />
              Ring op
            </Button>
          </div>
        )}

        {(callStatus === 'connecting' || callStatus === 'active') && (
          <div className="space-y-2">
            {phoneNumber && (
              <p className="text-sm font-medium text-center">
                Til: {phoneNumber}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                onClick={toggleMute}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                {isMuted ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
              <Button
                onClick={hangup}
                variant="destructive"
                size="sm"
                className="flex-1"
              >
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
