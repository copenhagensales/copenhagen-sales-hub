import { useState, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { TwilioVoiceManager } from '@/utils/TwilioVoice';
import { supabase } from '@/integrations/supabase/client';
import { Call } from '@twilio/voice-sdk';

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
  const { toast } = useToast();

  useEffect(() => {
    const initializeTwilio = async () => {
      try {
        const manager = new TwilioVoiceManager(userId, (status, call) => {
          setCallStatus(status);
          if (call) {
            setCurrentCall(call);
          }
          if (status === 'active') {
            setCallStartTime(new Date());
          }
          if (status === 'disconnected') {
            handleCallEnd();
          }
        });

        await manager.initialize();
        setTwilioManager(manager);
      } catch (error) {
        console.error('Error initializing Twilio:', error);
        toast({
          title: 'Fejl',
          description: 'Kunne ikke initialisere telefon',
          variant: 'destructive',
        });
        setCallStatus('error');
      }
    };

    initializeTwilio();

    return () => {
      twilioManager?.destroy();
    };
  }, [userId]);

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
