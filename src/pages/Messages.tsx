import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Mail, Check, Eye, RefreshCw, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { SendSmsDialog } from "@/components/SendSmsDialog";
import { SendEmailDialog } from "@/components/SendEmailDialog";

interface Message {
  id: string;
  type: string;
  direction: string;
  content?: string;
  outcome?: string;
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
      email: string;
    };
  };
}

const parseEmailContent = (outcome: string) => {
  // Extract subject
  const subjectMatch = outcome.match(/Subject: (.+?)\n/);
  const subject = subjectMatch ? subjectMatch[1].trim() : '';
  
  // Strip HTML tags and get plain text
  const htmlMatch = outcome.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = htmlMatch ? htmlMatch[1] : outcome;
  
  // Remove all HTML tags
  body = body.replace(/<[^>]+>/g, '');
  // Remove extra whitespace and newlines
  body = body.replace(/\s+/g, ' ').trim();
  // Decode HTML entities
  body = body.replace(/&nbsp;/g, ' ')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"');
  
  // Limit length for preview
  if (body.length > 200) {
    body = body.substring(0, 200) + '...';
  }
  
  return { subject, body };
};

const Messages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');
  const navigate = useNavigate();
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [smsApplicationId, setSmsApplicationId] = useState<string>('');
  const [smsPhone, setSmsPhone] = useState<string>('');
  const [smsName, setSmsName] = useState<string>('');
  
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailApplicationId, setEmailApplicationId] = useState<string>('');
  const [emailAddress, setEmailAddress] = useState<string>('');
  const [emailName, setEmailName] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [emailReplyToId, setEmailReplyToId] = useState<string>('');
  const [isFetchingEmails, setIsFetchingEmails] = useState(false);

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

  // Auto-fetch emails every 5 minutes
  useEffect(() => {
    const fetchEmailsQuietly = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("fetch-emails");
        if (error) throw error;
        
        const result = data as { processed: number; skipped: number };
        if (result.processed > 0) {
          fetchMessages();
        }
      } catch (error: any) {
        console.error("Background email fetch failed:", error);
      }
    };

    // Initial fetch
    fetchEmailsQuietly();

    // Set up interval for every 5 minutes (300000ms)
    const intervalId = setInterval(fetchEmailsQuietly, 300000);

    return () => clearInterval(intervalId);
  }, []);

  const fetchMessages = async () => {
    try {
      let query = supabase
        .from("communication_logs")
        .select(`
          *,
          application:applications(
            candidate_id,
            role,
            candidate:candidates(first_name, last_name, phone, email)
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

  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("communication_logs")
        .delete()
        .eq("id", messageId);

      if (error) throw error;

      toast.success("Besked slettet");
      fetchMessages();
    } catch (error: any) {
      toast.error("Kunne ikke slette besked");
      console.error(error);
    }
  };

  const unreadCount = messages.filter(m => !m.read).length;

  const handleFetchEmails = async () => {
    setIsFetchingEmails(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-emails");
      if (error) throw error;
      
      const result = data as { processed: number; skipped: number };
      if (result.processed > 0) {
        toast.success(`${result.processed} nye emails hentet`);
        fetchMessages();
      } else {
        toast.info("Ingen nye emails");
      }
    } catch (error: any) {
      console.error("Error fetching emails:", error);
      toast.error("Kunne ikke hente emails");
    } finally {
      setIsFetchingEmails(false);
    }
  };

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
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleFetchEmails}
                disabled={isFetchingEmails}
              >
                {isFetchingEmails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!isFetchingEmails && <RefreshCw className="mr-2 h-4 w-4" />}
                Hent nye emails
              </Button>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-lg px-3 py-1">
                  {unreadCount} ulæste
                </Badge>
              )}
            </div>
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

                            {message.type === "email" && message.outcome && (() => {
                              const { subject, body } = parseEmailContent(message.outcome);
                              return (
                                <div className="space-y-2">
                                  <p className="text-sm font-semibold">
                                    {subject}
                                  </p>
                                  {body && (
                                    <p className="text-sm p-3 bg-muted/30 rounded border">
                                      {body}
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                            
                            {message.type === "sms" && message.content && (
                              <p className="text-sm p-3 bg-muted/30 rounded border whitespace-pre-wrap">
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

                              {message.type === "email" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const { subject, body } = parseEmailContent(message.outcome || '');
                                    setEmailApplicationId(message.application_id);
                                    setEmailAddress((message.application.candidate as any).email || '');
                                    setEmailName(candidateName);
                                    setEmailSubject(subject.startsWith('Re: ') ? subject : `Re: ${subject}`);
                                    setEmailBody(`\n\n--- Original besked ---\n${body}`);
                                    setEmailReplyToId(message.content || '');
                                    setShowEmailDialog(true);
                                  }}
                                >
                                  <Mail className="h-3.5 w-3.5 mr-1.5" />
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
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => markAsUnread(message.id)}
                                  >
                                    Markér som ulæst
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deleteMessage(message.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                    Slet
                                  </Button>
                                </>
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

      <SendEmailDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        candidateEmail={emailAddress}
        candidateName={emailName}
        applicationId={emailApplicationId}
        initialSubject={emailSubject}
        initialBody={emailBody}
        replyToMessageId={emailReplyToId}
        onEmailSent={() => {
          setShowEmailDialog(false);
          fetchMessages();
        }}
      />
    </div>
  );
};

export default Messages;
