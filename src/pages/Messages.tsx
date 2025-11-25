import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Mail, Check, Eye } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { SendSmsDialog } from "@/components/SendSmsDialog";

interface Message {
  id: string;
  type: string;
  direction: string;
  content?: string;
  created_at: string;
  read: boolean;
  application_id: string;
  application: {
    candidate_id: string;
    role: string;
    candidate: {
      first_name: string;
      last_name: string;
      phone: string;
    };
  };
}

const Messages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');
  const navigate = useNavigate();
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [smsApplicationId, setSmsApplicationId] = useState<string>('');
  const [smsPhone, setSmsPhone] = useState<string>('');
  const [smsName, setSmsName] = useState<string>('');

  useEffect(() => {
    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel('messages-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'communication_logs',
          filter: 'direction=eq.inbound'
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  const fetchMessages = async () => {
    try {
      let query = supabase
        .from("communication_logs")
        .select(`
          *,
          application:applications(
            candidate_id,
            role,
            candidate:candidates(first_name, last_name, phone)
          )
        `)
        .eq("direction", "inbound")
        .in("type", ["sms", "email"])
        .order("created_at", { ascending: false });

      if (filter === 'unread') {
        query = query.eq('read', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      toast.error("Kunne ikke hente beskeder");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("communication_logs")
        .update({ read: true })
        .eq("id", messageId);

      if (error) throw error;

      toast.success("Markeret som læst");
      fetchMessages();
    } catch (error: any) {
      toast.error("Kunne ikke markere som læst");
      console.error(error);
    }
  };

  const markAsUnread = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("communication_logs")
        .update({ read: false })
        .eq("id", messageId);

      if (error) throw error;

      toast.success("Markeret som ulæst");
      fetchMessages();
    } catch (error: any) {
      toast.error("Kunne ikke markere som ulæst");
      console.error(error);
    }
  };

  const unreadCount = messages.filter(m => !m.read).length;

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Beskeder</h1>
              <p className="text-muted-foreground">Håndter indgående SMS og emails</p>
            </div>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-lg px-3 py-1">
                {unreadCount} ulæste
              </Badge>
            )}
          </div>

          <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')} className="w-full">
            <TabsList className="grid w-full max-w-[400px] grid-cols-2">
              <TabsTrigger value="unread">
                Ulæste {unreadCount > 0 && `(${unreadCount})`}
              </TabsTrigger>
              <TabsTrigger value="all">Alle</TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="space-y-4 mt-6">
              {loading ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Indlæser beskeder...
                  </CardContent>
                </Card>
              ) : messages.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    {filter === 'unread' ? 'Ingen ulæste beskeder' : 'Ingen beskeder'}
                  </CardContent>
                </Card>
              ) : (
                messages.map((message) => {
                  const candidate = message.application.candidate as any;
                  const candidateName = `${candidate.first_name} ${candidate.last_name}`;

                  return (
                    <Card 
                      key={message.id} 
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        !message.read ? 'border-l-4 border-l-primary bg-primary/5' : ''
                      }`}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="mt-1">
                            {message.type === "sms" ? (
                              <MessageSquare className="h-5 w-5 text-primary" />
                            ) : (
                              <Mail className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => navigate(`/candidates/${message.application.candidate_id}`)}
                                  className="font-semibold hover:underline"
                                >
                                  {candidateName}
                                </button>
                                <Badge variant="outline" className="capitalize">
                                  {message.type === "sms" ? "SMS" : "Email"}
                                </Badge>
                                {!message.read && (
                                  <Badge variant="default">Ny</Badge>
                                )}
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(message.created_at), "d. MMM yyyy HH:mm", { locale: da })}
                              </span>
                            </div>

                            {message.content && (
                              <p className="text-sm p-3 bg-muted/30 rounded border">
                                {message.content}
                              </p>
                            )}

                            <div className="flex items-center gap-2 pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/candidates/${message.application.candidate_id}`)}
                              >
                                <Eye className="h-3.5 w-3.5 mr-1.5" />
                                Se kandidat
                              </Button>
                              
                              {message.type === "sms" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSmsApplicationId(message.application_id);
                                    setSmsPhone(candidate.phone);
                                    setSmsName(candidateName);
                                    setShowSmsDialog(true);
                                  }}
                                >
                                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                                  Svar
                                </Button>
                              )}

                              {!message.read ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => markAsRead(message.id)}
                                >
                                  <Check className="h-3.5 w-3.5 mr-1.5" />
                                  Markér som læst
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => markAsUnread(message.id)}
                                >
                                  Markér som ulæst
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <SendSmsDialog
        open={showSmsDialog}
        onOpenChange={setShowSmsDialog}
        candidatePhone={smsPhone}
        candidateName={smsName}
        applicationId={smsApplicationId}
        onSmsSent={() => {
          setShowSmsDialog(false);
          fetchMessages();
        }}
      />
    </div>
  );
};

export default Messages;
