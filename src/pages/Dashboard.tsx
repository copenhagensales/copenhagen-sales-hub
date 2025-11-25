import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Inbox, TrendingUp, AlertCircle, UserPlus } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";

interface TeamHire {
  teamId: string;
  teamName: string;
  hireCount: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalApplications: 0,
    newApplications: 0,
    activeApplications: 0,
    overdueApplications: 0,
  });
  const [teamHires, setTeamHires] = useState<TeamHire[]>([]);

  useEffect(() => {
    fetchStats();
    fetchTeamHires();
  }, []);

  const fetchStats = async () => {
    try {
      const { count: totalApplications } = await supabase
        .from("applications")
        .select("*", { count: "exact", head: true });

      const { count: newApplications } = await supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("status", "ny");

      const { count: activeApplications } = await supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .in("status", ["telefon_screening", "case_rollespil", "interview", "tilbud"]);

      const today = new Date().toISOString().split("T")[0];
      const { count: overdueApplications } = await supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .lt("deadline", today)
        .not("status", "in", '("ansat","afslag","ghosted_cold")');

      setStats({
        totalApplications: totalApplications || 0,
        newApplications: newApplications || 0,
        activeApplications: activeApplications || 0,
        overdueApplications: overdueApplications || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchTeamHires = async () => {
    try {
      // Get start and end of current month
      const now = new Date();
      const monthStart = startOfMonth(now).toISOString().split("T")[0];
      const monthEnd = endOfMonth(now).toISOString().split("T")[0];

      // Fetch all teams
      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");

      if (teamsError) throw teamsError;

      // Fetch hired applications for this month with team assignments
      const { data: hiredApps, error: appsError } = await supabase
        .from("applications")
        .select("team_id")
        .eq("status", "ansat")
        .not("team_id", "is", null)
        .gte("hired_date", monthStart)
        .lte("hired_date", monthEnd);

      if (appsError) throw appsError;

      // Count hires per team
      const teamCounts = new Map<string, number>();
      hiredApps?.forEach((app) => {
        if (app.team_id) {
          teamCounts.set(app.team_id, (teamCounts.get(app.team_id) || 0) + 1);
        }
      });

      // Create team hire objects
      const teamHireData: TeamHire[] = (teams || []).map((team) => ({
        teamId: team.id,
        teamName: team.name,
        hireCount: teamCounts.get(team.id) || 0,
      }));

      setTeamHires(teamHireData);
    } catch (error) {
      console.error("Error fetching team hires:", error);
    }
  };

  const statCards = [
    {
      title: "Nye ansøgninger",
      value: stats.newApplications,
      icon: Inbox,
      color: "text-status-new",
    },
    {
      title: "Aktive ansøgninger",
      value: stats.activeApplications,
      icon: TrendingUp,
      color: "text-status-progress",
    },
    {
      title: "Total ansøgninger",
      value: stats.totalApplications,
      icon: Users,
      color: "text-primary",
    },
    {
      title: "Overskredet deadline",
      value: stats.overdueApplications,
      icon: AlertCircle,
      color: "text-status-rejected",
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Oversigt over rekrutteringsstatus</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCards.map((stat) => (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${stat.color}`}>
                    {stat.value}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Nye ansættelser denne måned</CardTitle>
                <UserPlus className="h-5 w-5 text-status-success" />
              </CardHeader>
              <CardContent>
                {teamHires.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Ingen teams fundet</p>
                ) : (
                  <div className="space-y-3">
                    {teamHires.map((team) => (
                      <div key={team.teamId} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{team.teamName}</span>
                        <Badge 
                          variant="outline" 
                          className={team.hireCount > 0 ? "bg-status-success/10 text-status-success border-status-success/20" : ""}
                        >
                          {team.hireCount} {team.hireCount === 1 ? "ansættelse" : "ansættelser"}
                        </Badge>
                      </div>
                    ))}
                    <div className="pt-3 border-t mt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">Total</span>
                        <Badge className="bg-primary/10 text-primary border-primary/20">
                          {teamHires.reduce((sum, team) => sum + team.hireCount, 0)} ansættelser
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Seneste aktivitet</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Kommende features: Timeline over seneste ansøgninger og handlinger
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
