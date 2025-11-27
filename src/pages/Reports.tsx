import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, Target, Award, Filter } from "lucide-react";
import { toast } from "sonner";

interface SourceStats {
  source: string;
  count: number;
  hired: number;
  conversionRate: number;
}

interface StatusStats {
  status: string;
  count: number;
  percentage: number;
}

interface RoleStats {
  role: string;
  total: number;
  hired: number;
  avgPerformance: number;
}

interface TeamStats {
  teamId: string;
  teamName: string;
  totalEmployees: number;
  activeEmployees: number;
  churnedEmployees: number;
  churnRate: number;
  totalRevenue: number;
  avgRevenuePerEmployee: number;
}

const Reports = () => {
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  
  // KPI Stats
  const [totalApplications, setTotalApplications] = useState(0);
  const [totalHired, setTotalHired] = useState(0);
  const [avgTimeToHire, setAvgTimeToHire] = useState(0);
  const [overallConversionRate, setOverallConversionRate] = useState(0);
  
  // Detailed Stats
  const [sourceStats, setSourceStats] = useState<SourceStats[]>([]);
  const [statusStats, setStatusStats] = useState<StatusStats[]>([]);
  const [roleStats, setRoleStats] = useState<RoleStats[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [performanceStats, setPerformanceStats] = useState<any[]>([]);

  useEffect(() => {
    fetchReportData();
  }, [roleFilter]);

  const fetchReportData = async () => {
    try {
      setLoading(true);

      // Build query with role filter
      let query = supabase.from("applications").select("*");
      if (roleFilter !== "all") {
        query = query.eq("role", roleFilter as any);
      }

      const { data: applications, error } = await query;
      if (error) throw error;

      // Calculate KPIs
      const total = applications?.length || 0;
      const hired = applications?.filter(app => app.status === "ansat").length || 0;
      
      setTotalApplications(total);
      setTotalHired(hired);
      setOverallConversionRate(total > 0 ? (hired / total) * 100 : 0);

      // Calculate average time to hire
      const hiredApps = applications?.filter(app => app.status === "ansat") || [];
      if (hiredApps.length > 0) {
        const avgDays = hiredApps.reduce((sum, app) => {
          const days = Math.floor(
            (new Date().getTime() - new Date(app.application_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          return sum + days;
        }, 0) / hiredApps.length;
        setAvgTimeToHire(avgDays);
      }

      // Calculate source statistics
      const sourceMap = new Map<string, { count: number; hired: number }>();
      applications?.forEach(app => {
        const source = app.source || "Ukendt";
        const current = sourceMap.get(source) || { count: 0, hired: 0 };
        sourceMap.set(source, {
          count: current.count + 1,
          hired: current.hired + (app.status === "ansat" ? 1 : 0),
        });
      });

      const sourceData: SourceStats[] = Array.from(sourceMap.entries()).map(([source, stats]) => ({
        source,
        count: stats.count,
        hired: stats.hired,
        conversionRate: stats.count > 0 ? (stats.hired / stats.count) * 100 : 0,
      })).sort((a, b) => b.count - a.count);
      setSourceStats(sourceData);

      // Calculate status distribution
      const statusMap = new Map<string, number>();
      applications?.forEach(app => {
        statusMap.set(app.status, (statusMap.get(app.status) || 0) + 1);
      });

      const statusData: StatusStats[] = Array.from(statusMap.entries()).map(([status, count]) => ({
        status,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }));
      setStatusStats(statusData);

      // Calculate role statistics
      const roleMap = new Map<string, { total: number; hired: number }>();
      applications?.forEach(app => {
        const current = roleMap.get(app.role) || { total: 0, hired: 0 };
        roleMap.set(app.role, {
          total: current.total + 1,
          hired: current.hired + (app.status === "ansat" ? 1 : 0),
        });
      });

      // Fetch performance reviews for hired candidates
      const { data: reviews } = await supabase
        .from("performance_reviews")
        .select(`
          *,
          application:applications(role, candidate_id)
        `);

      const rolePerformanceMap = new Map<string, number[]>();
      reviews?.forEach(review => {
        if (review.application?.role) {
          const ratings = rolePerformanceMap.get(review.application.role) || [];
          const numericRating = review.rating === "green" ? 5 : review.rating === "yellow" ? 3 : 
                              review.rating === "red" ? 1 : parseInt(review.rating) || 3;
          ratings.push(numericRating);
          rolePerformanceMap.set(review.application.role, ratings);
        }
      });

      const roleData: RoleStats[] = Array.from(roleMap.entries()).map(([role, stats]) => {
        const ratings = rolePerformanceMap.get(role) || [];
        const avgPerformance = ratings.length > 0 
          ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length 
          : 0;
        
        return {
          role,
          total: stats.total,
          hired: stats.hired,
          avgPerformance,
        };
      });
      setRoleStats(roleData);

      // Performance distribution
      const performanceDistribution = [
        { rating: "5 (Excellent)", count: 0 },
        { rating: "4 (God)", count: 0 },
        { rating: "3 (Middel)", count: 0 },
        { rating: "2 (Under middel)", count: 0 },
        { rating: "1 (Dårlig)", count: 0 },
      ];

      reviews?.forEach(review => {
        const numericRating = review.rating === "green" ? 5 : review.rating === "yellow" ? 3 : 
                            review.rating === "red" ? 1 : parseInt(review.rating) || 3;
        const index = 5 - numericRating;
        if (index >= 0 && index < 5) {
          performanceDistribution[index].count++;
        }
      });

      setPerformanceStats(performanceDistribution);

      // Calculate team statistics
      const { data: teams } = await supabase.from("teams").select("*");
      
      const { data: revenueData } = await supabase
        .from("revenue_data")
        .select(`
          *,
          application:applications(team_id, employment_ended_date)
        `);

      const teamMap = new Map<string, {
        totalEmployees: number;
        activeEmployees: number;
        churnedEmployees: number;
        totalRevenue: number;
      }>();

      // Initialize team stats
      teams?.forEach(team => {
        teamMap.set(team.id, {
          totalEmployees: 0,
          activeEmployees: 0,
          churnedEmployees: 0,
          totalRevenue: 0,
        });
      });

      // Count employees per team
      applications?.forEach(app => {
        if (app.status === "ansat" && app.team_id) {
          const stats = teamMap.get(app.team_id);
          if (stats) {
            stats.totalEmployees++;
            if (app.employment_ended_date) {
              stats.churnedEmployees++;
            } else {
              stats.activeEmployees++;
            }
          }
        }
      });

      // Calculate revenue per team
      revenueData?.forEach(rev => {
        if (rev.application?.team_id && rev.revenue) {
          const stats = teamMap.get(rev.application.team_id);
          if (stats) {
            stats.totalRevenue += parseFloat(rev.revenue.toString());
          }
        }
      });

      const teamStatsData: TeamStats[] = teams?.map(team => {
        const stats = teamMap.get(team.id) || {
          totalEmployees: 0,
          activeEmployees: 0,
          churnedEmployees: 0,
          totalRevenue: 0,
        };

        return {
          teamId: team.id,
          teamName: team.name,
          totalEmployees: stats.totalEmployees,
          activeEmployees: stats.activeEmployees,
          churnedEmployees: stats.churnedEmployees,
          churnRate: stats.totalEmployees > 0 
            ? (stats.churnedEmployees / stats.totalEmployees) * 100 
            : 0,
          totalRevenue: stats.totalRevenue,
          avgRevenuePerEmployee: stats.totalEmployees > 0 
            ? stats.totalRevenue / stats.totalEmployees 
            : 0,
        };
      }) || [];

      setTeamStats(teamStatsData);

    } catch (error: any) {
      toast.error("Kunne ikke hente rapportdata");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const statusLabels: Record<string, string> = {
    ansat: "Ansat",
    udskudt_samtale: "Udskudt samtale",
    ikke_kvalificeret: "Ikke kvalificeret",
    ikke_ansat: "Ikke ansat",
    startet: "Startet",
  };

  const roleLabels: Record<string, string> = {
    fieldmarketing: "Fieldmarketing",
    salgskonsulent: "Salgskonsulent",
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p>Indlæser rapporter...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-auto md:pt-0 pt-16">
        <div className="p-4 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Rapporter & Analyse</h1>
              <p className="text-muted-foreground">Omfattende rekrutteringsstatistik og KPI'er</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle roller</SelectItem>
                  <SelectItem value="fieldmarketing">Fieldmarketing</SelectItem>
                  <SelectItem value="salgskonsulent">Salgskonsulent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Ansøgninger
                </CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalApplications}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ansættelser
                </CardTitle>
                <Award className="h-4 w-4 text-status-success" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-status-success">{totalHired}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Konverteringsrate
                </CardTitle>
                <Target className="h-4 w-4 text-status-progress" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-status-progress">
                  {overallConversionRate.toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Gns. Tid til Ansættelse
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{Math.round(avgTimeToHire)}</div>
                <p className="text-xs text-muted-foreground mt-1">dage</p>
              </CardContent>
            </Card>
          </div>

            <Tabs defaultValue="sources" className="space-y-6">
            <TabsList>
              <TabsTrigger value="sources">Kilder</TabsTrigger>
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
              <TabsTrigger value="roles">Roller</TabsTrigger>
              <TabsTrigger value="teams">Teams</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="sources" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Ansøgninger pr. Kilde</CardTitle>
                    <CardDescription>Fordeling af ansøgninger fra forskellige kilder</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={sourceStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="source" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="count" fill="#3b82f6" name="Ansøgninger" />
                        <Bar dataKey="hired" fill="#10b981" name="Ansættelser" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Konverteringsrate pr. Kilde</CardTitle>
                    <CardDescription>Succesrate for forskellige kilder</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {sourceStats.map((source, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{source.source}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {source.hired}/{source.count}
                              </span>
                              <Badge variant="outline">{source.conversionRate.toFixed(1)}%</Badge>
                            </div>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-status-success h-2 rounded-full transition-all"
                              style={{ width: `${source.conversionRate}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="pipeline" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Status Fordeling</CardTitle>
                    <CardDescription>Hvor kandidaterne befinder sig i pipeline</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={statusStats}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${statusLabels[entry.status]}: ${entry.percentage.toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {statusStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Pipeline Oversigt</CardTitle>
                    <CardDescription>Detaljeret statusfordeling</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {statusStats.map((stat, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                          <span className="font-medium">{statusLabels[stat.status]}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold">{stat.count}</span>
                            <Badge variant="outline">{stat.percentage.toFixed(1)}%</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="roles" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance pr. Rolle</CardTitle>
                    <CardDescription>Sammenligning mellem Fieldmarketing og Salgskonsulent</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={roleStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="role" 
                          tickFormatter={(value) => roleLabels[value] || value}
                        />
                        <YAxis />
                        <Tooltip 
                          labelFormatter={(value) => roleLabels[value] || value}
                        />
                        <Legend />
                        <Bar dataKey="total" fill="#3b82f6" name="Total Ansøgninger" />
                        <Bar dataKey="hired" fill="#10b981" name="Ansættelser" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Rolle Statistik</CardTitle>
                    <CardDescription>Detaljeret oversigt pr. rolle</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {roleStats.map((role, index) => (
                        <div key={index} className="space-y-3 p-4 bg-muted/50 rounded-lg">
                          <h4 className="font-semibold text-lg">{roleLabels[role.role]}</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Total Ansøgninger</p>
                              <p className="text-2xl font-bold">{role.total}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Ansættelser</p>
                              <p className="text-2xl font-bold text-status-success">{role.hired}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Konverteringsrate</p>
                              <p className="text-xl font-bold">
                                {role.total > 0 ? ((role.hired / role.total) * 100).toFixed(1) : 0}%
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Gns. Performance</p>
                              <p className="text-xl font-bold">
                                {role.avgPerformance > 0 ? role.avgPerformance.toFixed(1) : 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="teams" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Indtjening pr. Team</CardTitle>
                    <CardDescription>Total omsætning og gennemsnit pr. medarbejder</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={teamStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="teamName" />
                        <YAxis />
                        <Tooltip 
                          formatter={(value: number) => `${value.toLocaleString('da-DK')} kr.`}
                        />
                        <Legend />
                        <Bar dataKey="totalRevenue" fill="#10b981" name="Total Indtjening (kr.)" />
                        <Bar dataKey="avgRevenuePerEmployee" fill="#3b82f6" name="Gns. pr. Medarbejder (kr.)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Churn Rate pr. Team</CardTitle>
                    <CardDescription>Medarbejderfrafald fordelt på teams</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {teamStats.map((team, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{team.teamName}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {team.churnedEmployees}/{team.totalEmployees}
                              </span>
                              <Badge 
                                variant="outline"
                                className={team.churnRate > 20 ? "bg-status-rejected/10 text-status-rejected" : ""}
                              >
                                {team.churnRate.toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                team.churnRate > 20 ? "bg-status-rejected" : "bg-status-warning"
                              }`}
                              style={{ width: `${Math.min(team.churnRate, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Team Oversigt</CardTitle>
                    <CardDescription>Detaljeret statistik pr. team</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {teamStats.map((team, index) => (
                        <div key={index} className="p-4 bg-muted/50 rounded-lg space-y-3">
                          <h4 className="font-semibold text-lg">{team.teamName}</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground">Aktive Medarbejdere</p>
                              <p className="text-xl font-bold text-status-success">{team.activeEmployees}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Stoppet</p>
                              <p className="text-xl font-bold text-status-rejected">{team.churnedEmployees}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Total Indtjening</p>
                              <p className="text-lg font-bold">{team.totalRevenue.toLocaleString('da-DK')} kr.</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Gns. pr. Person</p>
                              <p className="text-lg font-bold">{Math.round(team.avgRevenuePerEmployee).toLocaleString('da-DK')} kr.</p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-xs text-muted-foreground">Churn Rate</p>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-muted rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      team.churnRate > 20 ? "bg-status-rejected" : "bg-status-warning"
                                    }`}
                                    style={{ width: `${Math.min(team.churnRate, 100)}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium">{team.churnRate.toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {teamStats.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        Ingen team-data tilgængelig endnu
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Samlet oversigt */}
              <Card>
                <CardHeader>
                  <CardTitle>Samlet Oversigt</CardTitle>
                  <CardDescription>Aggregeret data på tværs af alle teams</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="text-center p-4 bg-primary/5 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Total Aktive</p>
                      <p className="text-3xl font-bold text-primary">
                        {teamStats.reduce((sum, t) => sum + t.activeEmployees, 0)}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-status-rejected/5 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Total Churn</p>
                      <p className="text-3xl font-bold text-status-rejected">
                        {teamStats.reduce((sum, t) => sum + t.churnedEmployees, 0)}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-status-success/5 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Total Indtjening</p>
                      <p className="text-3xl font-bold text-status-success">
                        {teamStats.reduce((sum, t) => sum + t.totalRevenue, 0).toLocaleString('da-DK')} kr.
                      </p>
                    </div>
                    <div className="text-center p-4 bg-status-warning/5 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Gns. Churn Rate</p>
                      <p className="text-3xl font-bold text-status-warning">
                        {teamStats.length > 0 
                          ? (teamStats.reduce((sum, t) => sum + t.churnRate, 0) / teamStats.length).toFixed(1)
                          : 0}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Fordeling</CardTitle>
                    <CardDescription>30/60/90 dage reviews for ansatte</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={performanceStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="rating" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#10b981" name="Antal Reviews" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Performance Indsigt</CardTitle>
                    <CardDescription>Kvalitet af ansættelser over tid</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-status-success/10 rounded-lg border border-status-success/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Excellent Performance</span>
                          <Badge className="bg-status-success text-white">
                            {performanceStats[0]?.count || 0}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Kandidater der overgår forventninger
                        </p>
                      </div>

                      <div className="p-4 bg-status-progress/10 rounded-lg border border-status-progress/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">God til Middel</span>
                          <Badge className="bg-status-progress text-white">
                            {(performanceStats[1]?.count || 0) + (performanceStats[2]?.count || 0)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Kandidater der møder forventninger
                        </p>
                      </div>

                      <div className="p-4 bg-status-rejected/10 rounded-lg border border-status-rejected/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Under Forventning</span>
                          <Badge className="bg-status-rejected text-white">
                            {(performanceStats[3]?.count || 0) + (performanceStats[4]?.count || 0)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Kandidater der kræver forbedring
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Reports;
