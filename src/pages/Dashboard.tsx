import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Inbox, TrendingUp, AlertCircle } from "lucide-react";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalApplications: 0,
    newApplications: 0,
    activeApplications: 0,
    overdueApplications: 0,
  });

  useEffect(() => {
    fetchStats();
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
              <CardHeader>
                <CardTitle>Hurtige handlinger</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Kommende features: Se overskredet deadlines, kommende interviews, m.m.
                </p>
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
