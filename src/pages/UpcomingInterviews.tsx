import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Phone, Mail } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface UpcomingInterview {
  id: string;
  interview_date: string;
  role: string;
  candidate_id: string;
  candidate: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
  };
}

interface GroupedInterview {
  date: string;
  count: number;
  interviews: UpcomingInterview[];
}

const UpcomingInterviews = () => {
  const [upcomingInterviews, setUpcomingInterviews] = useState<GroupedInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUpcomingInterviews();
  }, []);

  const fetchUpcomingInterviews = async () => {
    try {
      const today = new Date().toISOString();

      const { data: applications, error } = await supabase
        .from("applications")
        .select(`
          id,
          interview_date,
          role,
          candidate_id,
          candidate:candidates (
            id,
            first_name,
            last_name,
            phone,
            email
          )
        `)
        .eq("status", "jobsamtale")
        .gte("interview_date", today)
        .not("interview_date", "is", null)
        .order("interview_date", { ascending: true });

      if (error) throw error;

      // Group by date
      const grouped = new Map<string, GroupedInterview>();

      applications?.forEach((app: any) => {
        if (!app.interview_date) return;

        const dateKey = app.interview_date.split("T")[0];
        
        if (!grouped.has(dateKey)) {
          grouped.set(dateKey, {
            date: dateKey,
            count: 0,
            interviews: [],
          });
        }

        const group = grouped.get(dateKey)!;
        group.count++;
        group.interviews.push(app);
      });

      const groupedArray = Array.from(grouped.values()).sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      setUpcomingInterviews(groupedArray);
    } catch (error) {
      console.error("Error fetching upcoming interviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const roleLabels: Record<string, string> = {
    fieldmarketing: "Fieldmarketing",
    salgskonsulent: "Salgskonsulent",
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-auto md:pt-0 pt-16">
        <div className="p-4 md:p-8">
          <div className="mb-6 md:mb-8">
            <h1 className="text-3xl font-bold mb-2">Kommende samtaler</h1>
            <p className="text-muted-foreground">
              Oversigt over planlagte jobsamtaler
            </p>
          </div>

          {loading ? (
            <p className="text-muted-foreground">Indlæser kommende samtaler...</p>
          ) : upcomingInterviews.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Ingen kommende samtaler planlagt
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {upcomingInterviews.map((group, index) => (
                <Card key={`${group.date}_${index}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">
                          {format(new Date(group.date), "EEEE d. MMMM yyyy", {
                            locale: da,
                          })}
                        </CardTitle>
                      </div>
                      <Badge variant="outline" className="text-sm">
                        {group.count} {group.count === 1 ? "samtale" : "samtaler"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {group.interviews.map((interview) => (
                        <div
                          key={interview.id}
                          className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/candidates/${interview.candidate_id}`)}
                        >
                          <div className="flex-1">
                            <p className="font-medium">
                              {interview.candidate.first_name} {interview.candidate.last_name}
                            </p>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {interview.candidate.phone}
                              </span>
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {interview.candidate.email}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary">
                              {roleLabels[interview.role] || interview.role}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(interview.interview_date), "HH:mm")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpcomingInterviews;
