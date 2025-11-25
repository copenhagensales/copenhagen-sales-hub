import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Inbox, TrendingUp, AlertCircle, UserPlus, Target } from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, format, subYears } from "date-fns";
import { da } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";

interface TeamHire {
  teamId: string;
  teamName: string;
  hireCount: number;
}

interface TrendDataPoint {
  month: string;
  [key: string]: string | number;
}

interface TeamConversion {
  teamId: string;
  teamName: string;
  totalHired: number;
  churnedCount: number;
  churnRate: number;
  totalRevenue: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalApplications: 0,
    newApplications: 0,
    activeApplications: 0,
    overdueApplications: 0,
  });
  const [teamHires, setTeamHires] = useState<TeamHire[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [conversionData, setConversionData] = useState<TeamConversion[]>([]);
  const [conversionPeriod, setConversionPeriod] = useState<string>("6months");

  useEffect(() => {
    fetchStats();
    fetchTeamHires();
    fetchTeamHiresTrend();
  }, []);

  useEffect(() => {
    fetchTeamConversionRates();
  }, [conversionPeriod]);

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

  const fetchTeamHiresTrend = async () => {
    try {
      // Fetch all teams
      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");

      if (teamsError) throw teamsError;

      // Generate last 6 months
      const now = new Date();
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(now, i);
        months.push({
          date: date,
          monthStart: startOfMonth(date).toISOString().split("T")[0],
          monthEnd: endOfMonth(date).toISOString().split("T")[0],
          label: format(date, "MMM yyyy", { locale: da }),
        });
      }

      // Fetch all hired applications from the last 6 months
      const sixMonthsAgo = months[0].monthStart;
      const { data: hiredApps, error: appsError } = await supabase
        .from("applications")
        .select("team_id, hired_date")
        .eq("status", "ansat")
        .not("team_id", "is", null)
        .not("hired_date", "is", null)
        .gte("hired_date", sixMonthsAgo);

      if (appsError) throw appsError;

      // Build trend data
      const chartData: TrendDataPoint[] = months.map((month) => {
        const dataPoint: TrendDataPoint = { month: month.label };
        
        teams?.forEach((team) => {
          const count = hiredApps?.filter((app) => {
            if (!app.hired_date || app.team_id !== team.id) return false;
            const hiredDate = app.hired_date.split("T")[0];
            return hiredDate >= month.monthStart && hiredDate <= month.monthEnd;
          }).length || 0;
          
          dataPoint[team.name] = count;
        });

        return dataPoint;
      });

      setTrendData(chartData);
    } catch (error) {
      console.error("Error fetching team hires trend:", error);
    }
  };

  const fetchTeamConversionRates = async () => {
    try {
      // Calculate date range based on selected period
      const now = new Date();
      let startDate: string;
      
      switch (conversionPeriod) {
        case "1month":
          startDate = subMonths(now, 1).toISOString().split("T")[0];
          break;
        case "3months":
          startDate = subMonths(now, 3).toISOString().split("T")[0];
          break;
        case "6months":
          startDate = subMonths(now, 6).toISOString().split("T")[0];
          break;
        case "1year":
          startDate = subYears(now, 1).toISOString().split("T")[0];
          break;
        case "all":
          startDate = "2000-01-01"; // Far back enough to get all data
          break;
        default:
          startDate = subMonths(now, 6).toISOString().split("T")[0];
      }

      // Fetch all teams
      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");

      if (teamsError) throw teamsError;

      // Fetch all hired applications in the period
      const { data: hiredApps, error: appsError } = await supabase
        .from("applications")
        .select("team_id, hired_date, employment_ended_date")
        .eq("status", "ansat")
        .not("team_id", "is", null)
        .gte("hired_date", startDate);

      if (appsError) throw appsError;

      // Fetch revenue data
      const { data: revenueData, error: revenueError } = await supabase
        .from("revenue_data")
        .select("application_id, revenue");

      if (revenueError) throw revenueError;

      // Calculate churn and revenue per team
      const teamStats: TeamConversion[] = (teams || []).map((team) => {
        const teamHires = hiredApps?.filter(app => app.team_id === team.id) || [];
        const totalHired = teamHires.length;
        const churnedCount = teamHires.filter(app => app.employment_ended_date !== null).length;
        const churnRate = totalHired > 0 
          ? Math.round((churnedCount / totalHired) * 100) 
          : 0;

        // Calculate total revenue for this team's hires
        const teamApplicationIds = teamHires.map(app => app);
        const totalRevenue = revenueData
          ?.filter(rev => teamHires.some(app => app.team_id === team.id))
          .reduce((sum, rev) => sum + (Number(rev.revenue) || 0), 0) || 0;

        return {
          teamId: team.id,
          teamName: team.name,
          totalHired,
          churnedCount,
          churnRate,
          totalRevenue: Math.round(totalRevenue),
        };
      });

      // Sort by total revenue descending
      teamStats.sort((a, b) => b.totalRevenue - a.totalRevenue);

      setConversionData(teamStats);
    } catch (error) {
      console.error("Error fetching team stats:", error);
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <CardTitle>Team Performance: Churn & Indtjening</CardTitle>
              </div>
              <Select value={conversionPeriod} onValueChange={setConversionPeriod}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Vælg periode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1month">Sidste måned</SelectItem>
                  <SelectItem value="3months">Sidste 3 måneder</SelectItem>
                  <SelectItem value="6months">Sidste 6 måneder</SelectItem>
                  <SelectItem value="1year">Sidste år</SelectItem>
                  <SelectItem value="all">Alle data</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {conversionData.length === 0 ? (
                <p className="text-muted-foreground text-sm">Indlæser team data...</p>
              ) : (
                <div className="space-y-6">
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={conversionData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="teamName" 
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis 
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          label={{ value: 'Indtjening (kr.)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                          formatter={(value: any, name: string) => {
                            if (name === "totalRevenue") return [`${value.toLocaleString('da-DK')} kr.`, "Indtjening"];
                            return [value, name];
                          }}
                        />
                        <Bar 
                          dataKey="totalRevenue" 
                          fill="hsl(var(--primary))" 
                          radius={[8, 8, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-3">Detaljeret oversigt</h4>
                    <div className="space-y-3">
                      {conversionData.map((team) => (
                        <div key={team.teamId} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">{team.teamName}</div>
                            <div className="text-sm text-muted-foreground">
                              {team.totalHired} ansatte • {team.churnedCount} stoppet • {team.totalRevenue.toLocaleString('da-DK')} kr. indtjening
                            </div>
                          </div>
                          <Badge 
                            className={
                              team.churnRate <= 10 
                                ? "bg-status-success/10 text-status-success border-status-success/20" 
                                : team.churnRate <= 25
                                ? "bg-status-warning/10 text-status-warning border-status-warning/20"
                                : "bg-status-rejected/10 text-status-rejected border-status-rejected/20"
                            }
                          >
                            {team.churnRate}% churn
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

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

          <Card>
            <CardHeader>
              <CardTitle>Ansættelser trend - sidste 6 måneder</CardTitle>
            </CardHeader>
            <CardContent>
              {trendData.length === 0 ? (
                <p className="text-muted-foreground text-sm">Indlæser trend data...</p>
              ) : (
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        allowDecimals={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="line"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Team Nord" 
                        stroke="hsl(var(--chart-1))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--chart-1))' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Team Syd" 
                        stroke="hsl(var(--chart-2))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--chart-2))' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Team Vest" 
                        stroke="hsl(var(--chart-3))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--chart-3))' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Team Øst" 
                        stroke="hsl(var(--chart-4))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--chart-4))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
