import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useSmsNotifications = () => {
  useEffect(() => {
    const channel = supabase
      .channel('sms-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'communication_logs',
          filter: 'type=eq.sms,direction=eq.inbound'
        },
        async (payload) => {
          // Fetch candidate name for the notification
          const { data: application } = await supabase
            .from('applications')
            .select('candidate_id, candidates(first_name, last_name)')
            .eq('id', payload.new.application_id)
            .single();

          if (application) {
            const candidate = application.candidates as any;
            const candidateName = `${candidate.first_name} ${candidate.last_name}`;
            
            toast({
              title: "📩 Ny SMS modtaget",
              description: `${candidateName}: ${payload.new.content?.substring(0, 50) || ''}${payload.new.content && payload.new.content.length > 50 ? '...' : ''}`,
              duration: 5000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
};
