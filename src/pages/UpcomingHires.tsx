import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface UpcomingHire {
  id: string;
  hired_date: string;
  team: {
    id: string;
    name: string;
  };
  candidate: {
    first_name: string;
    last_name: string;
  };
}

interface GroupedHire {
  date: string;
  teamName: string;
  teamId: string;
  count: number;
  hires: UpcomingHire[];
}

const UpcomingHires = () => {
  const [upcomingHires, setUpcomingHires] = useState<GroupedHire[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUpcomingHires();
  }, []);

  const fetchUpcomingHires = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];

      // Fetch all applications with status "ansat" and hired_date >= today
      const { data: applications, error } = await supabase
        .from("applications")
        .select(`
          id,
          hired_date,
          team:teams (
            id,
            name
          ),
          candidate:candidates (
            first_name,
            last_name
          )
        `)
        .eq("status", "ansat")
        .gte("hired_date", today)
        .not("team_id", "is", null)
        .order("hired_date", { ascending: true });

      if (error) throw error;

      // Group by date and team
      const grouped = new Map<string, GroupedHire>();

      applications?.forEach((app: any) => {
        if (!app.team || !app.hired_date) return;

        const key = `${app.hired_date}_${app.team.id}`;
        
        if (!grouped.has(key)) {
          grouped.set(key, {
            date: app.hired_date,
            teamName: app.team.name,
            teamId: app.team.id,
            count: 0,
            hires: [],
          });
        }

        const group = grouped.get(key)!;
        group.count++;
        group.hires.push(app);
      });

      // Convert to array and sort by date
      const groupedArray = Array.from(grouped.values()).sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      setUpcomingHires(groupedArray);
    } catch (error) {
      console.error("Error fetching upcoming hires:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-auto md:pt-0 pt-16">
        <div className="p-4 md:p-8">
          <div className="mb-6 md:mb-8">
            <h1 className="text-3xl font-bold mb-2">Kommende ansættelser</h1>
            <p className="text-muted-foreground">
              Oversigt over planlagte ansættelsesdatoer
            </p>
          </div>

          {loading ? (
            <p className="text-muted-foreground">Indlæser kommende ansættelser...</p>
          ) : upcomingHires.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Ingen kommende ansættelser planlagt
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {upcomingHires.map((group, index) => (
                <Card key={`${group.teamId}_${group.date}_${index}`}>
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
                        {group.teamName}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {group.count} {group.count === 1 ? "ansættelse" : "ansættelser"}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {group.hires.map((hire) => (
                        <div
                          key={hire.id}
                          className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="font-medium">
                              {hire.candidate.first_name} {hire.candidate.last_name}
                            </p>
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

export default UpcomingHires;
