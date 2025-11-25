import { Phone, PhoneOff } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  onHangup 
}: CallStatusDialogProps) => {
  const [callDuration, setCallDuration] = useState(0);
  const [status, setStatus] = useState<'ringing' | 'connected'>('ringing');
  const [callStartTime] = useState(new Date());

  useEffect(() => {
    // Simulate connection after 3 seconds
    const connectTimer = setTimeout(() => {
      setStatus('connected');
    }, 3000);

    return () => clearTimeout(connectTimer);
  }, []);

  useEffect(() => {
    if (status === 'connected') {
      const interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleHangup = async () => {
    // Log call to database if we have an applicationId
    if (applicationId && status === 'connected') {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        await supabase.from('communication_logs').insert({
          application_id: applicationId,
          type: 'phone',
          direction: 'outbound',
          duration: callDuration,
          outcome: 'completed',
          content: `Opkald til ${candidatePhone}`,
          created_by: user?.id
        });
        
        console.log('Call logged successfully');
      } catch (error) {
        console.error('Error logging call:', error);
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
            <div className={`
              w-20 h-20 rounded-full flex items-center justify-center
              ${status === 'ringing' 
                ? 'bg-status-progress/20 animate-pulse' 
                : 'bg-status-success/20'
              }
            `}>
              <Phone className={`
                h-10 w-10
                ${status === 'ringing' ? 'text-status-progress' : 'text-status-success'}
              `} />
            </div>
            
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">
                {status === 'ringing' ? 'Ringer op...' : 'Forbundet'}
              </p>
              <h3 className="text-xl font-semibold">{candidateName}</h3>
              <p className="text-sm text-muted-foreground">{candidatePhone}</p>
            </div>
          </div>

          {/* Call duration */}
          {status === 'connected' && (
            <div className="text-center">
              <p className="text-3xl font-mono font-semibold tabular-nums">
                {formatDuration(callDuration)}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-center">
            <Button
              onClick={handleHangup}
              variant="destructive"
              size="lg"
              className="rounded-full w-16 h-16"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
          </div>

          {callSid && (
            <p className="text-xs text-center text-muted-foreground">
              Call ID: {callSid.slice(0, 8)}...
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};
