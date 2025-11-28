import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, TrendingUp, TrendingDown, DollarSign, Calendar, Users, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";

interface Employee {
  id: string;
  candidate_id: string;
  role: string;
  team_id: string;
  sub_team?: string;
  hired_date: string;
  employment_ended_date?: string;
  employment_end_reason?: string;
  candidate: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  team?: {
    name: string;
  };
  revenue_data?: RevenueData[];
}

interface RevenueData {
  id?: string;
  period: number; // 30, 60, or 90 days
  revenue: number;
}

interface PerformanceReview {
  id: string;
  review_period: number;
  rating: string;
  review_date: string;
  comments?: string;
}

const Employees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showRevenueDialog, setShowRevenueDialog] = useState(false);
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [performanceReviews, setPerformanceReviews] = useState<PerformanceReview[]>([]);

  useEffect(() => {
    fetchEmployees();
    fetchTeams();
  }, [filterStatus]);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("name");

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error("Error fetching teams:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      let query = supabase
        .from("applications")
        .select(`
          id,
          candidate_id,
          role,
          team_id,
          sub_team,
          hired_date,
          employment_ended_date,
          employment_end_reason,
          candidate:candidates(first_name, last_name, email, phone),
          team:teams(name)
        `)
        .eq("status", "ansat")
        .order("hired_date", { ascending: false });

      if (filterStatus === "active") {
        query = query.is("employment_ended_date", null);
      } else if (filterStatus === "stopped") {
        query = query.not("employment_ended_date", "is", null);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch revenue data for all employees
      const employeesWithRevenue = await Promise.all(
        (data || []).map(async (emp) => {
          const { data: revenue } = await supabase
            .from("revenue_data")
            .select("*")
            .eq("application_id", emp.id);
          
          return { ...emp, revenue_data: revenue || [] };
        })
      );
      
      setEmployees(employeesWithRevenue as any);
    } catch (error: any) {
      toast.error("Kunne ikke hente ansatte");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeDetails = async (employeeId: string) => {
    try {
      // Fetch revenue data
      const { data: revenue, error: revenueError } = await supabase
        .from("revenue_data")
        .select("*")
        .eq("application_id", employeeId)
        .order("period", { ascending: true });

      if (revenueError) throw revenueError;
      setRevenueData(revenue || []);

      // Fetch performance reviews
      const { data: reviews, error: reviewsError } = await supabase
        .from("performance_reviews")
        .select("*")
        .eq("application_id", employeeId)
        .order("review_date", { ascending: false });

      if (reviewsError) throw reviewsError;
      setPerformanceReviews(reviews || []);
    } catch (error) {
      console.error("Error fetching employee details:", error);
    }
  };

  const handleAddRevenue = async (employeeId: string, data: RevenueData) => {
    try {
      const { error } = await supabase.from("revenue_data").insert({
        application_id: employeeId,
        period: data.period,
        revenue: data.revenue,
      });

      if (error) throw error;

      toast.success("Dækningsbidrag tilføjet!");
      fetchEmployeeDetails(employeeId);
    } catch (error: any) {
      toast.error("Kunne ikke tilføje dækningsbidrag");
      console.error(error);
    }
  };

  const handleStopEmployee = async (
    employeeId: string,
    endDate: string,
    reason: string
  ) => {
    try {
      const { error } = await supabase
        .from("applications")
        .update({
          employment_ended_date: endDate,
          employment_end_reason: reason,
        })
        .eq("id", employeeId);

      if (error) throw error;

      toast.success("Medarbejder markeret som stoppet");
      setShowStopDialog(false);
      fetchEmployees();
    } catch (error: any) {
      toast.error("Kunne ikke opdatere medarbejder");
      console.error(error);
    }
  };

  const handleStatusChange = async (employeeId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("applications")
        .update({ status: newStatus as any })
        .eq("id", employeeId);

      if (error) throw error;

      toast.success("Status opdateret!");
      fetchEmployees();
    } catch (error: any) {
      toast.error("Kunne ikke opdatere status");
      console.error(error);
    }
  };

  const handleTeamChange = async (employeeId: string, newTeamId: string) => {
    try {
      const emp = employees.find(e => e.id === employeeId);
      const oldTeam = teams.find(t => t.id === emp?.team_id);
      const newTeam = teams.find(t => t.id === newTeamId);
      
      const updates: any = { team_id: newTeamId || null };
      
      // Clear sub_team if switching away from United
      if (oldTeam?.name === "United" && newTeam?.name !== "United") {
        updates.sub_team = null;
      }
      
      const { error } = await supabase
        .from("applications")
        .update(updates)
        .eq("id", employeeId);

      if (error) throw error;

      toast.success("Team opdateret!");
      fetchEmployees();
    } catch (error: any) {
      toast.error("Kunne ikke opdatere team");
      console.error(error);
    }
  };

  const handleSubTeamChange = async (employeeId: string, newSubTeam: string) => {
    try {
      const { error } = await supabase
        .from("applications")
        .update({ sub_team: newSubTeam || null })
        .eq("id", employeeId);

      if (error) throw error;

      toast.success("Underteam opdateret!");
      fetchEmployees();
    } catch (error: any) {
      toast.error("Kunne ikke opdatere underteam");
      console.error(error);
    }
  };

  const handleRoleChange = async (employeeId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from("applications")
        .update({ role: newRole as any })
        .eq("id", employeeId);

      if (error) throw error;

      toast.success("Stilling opdateret!");
      fetchEmployees();
    } catch (error: any) {
      toast.error("Kunne ikke opdatere stilling");
      console.error(error);
    }
  };

  const handleHiredDateChange = async (employeeId: string, newDate: string) => {
    try {
      const { error } = await supabase
        .from("applications")
        .update({ hired_date: newDate })
        .eq("id", employeeId);

      if (error) throw error;

      toast.success("Ansat dato opdateret!");
      fetchEmployees();
    } catch (error: any) {
      toast.error("Kunne ikke opdatere ansat dato");
      console.error(error);
    }
  };

  const roleLabels: Record<string, string> = {
    fieldmarketing: "Fieldmarketing",
    salgskonsulent: "Salgskonsulent",
  };

  // Check if revenue data is overdue based on hire date
  const isRevenueOverdue = (emp: Employee, period: number) => {
    if (!emp.hired_date || emp.employment_ended_date) return false;
    
    const hiredDate = new Date(emp.hired_date);
    const today = new Date();
    const daysSinceHired = Math.floor((today.getTime() - hiredDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const hasRevenue = emp.revenue_data?.some(r => r.period === period);
    return daysSinceHired >= period && !hasRevenue;
  };

  const getRevenueForPeriod = (emp: Employee, period: number) => {
    return emp.revenue_data?.find(r => r.period === period);
  };

  const filteredEmployees = employees.filter((emp) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      emp.candidate.first_name.toLowerCase().includes(searchLower) ||
      emp.candidate.last_name.toLowerCase().includes(searchLower) ||
      emp.candidate.email.toLowerCase().includes(searchLower);

    const matchesTeam = filterTeam === "all" || emp.team_id === filterTeam;

    return matchesSearch && matchesTeam;
  }).sort((a, b) => {
    // Sort by overdue status first (overdue employees at top)
    const aOverdue = isRevenueOverdue(a, 30) || isRevenueOverdue(a, 60) || isRevenueOverdue(a, 90);
    const bOverdue = isRevenueOverdue(b, 30) || isRevenueOverdue(b, 60) || isRevenueOverdue(b, 90);
    
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    
    // Then by hire date (newest first)
    return new Date(b.hired_date).getTime() - new Date(a.hired_date).getTime();
  });

  const activeCount = employees.filter((e) => !e.employment_ended_date).length;
  const stoppedCount = employees.filter((e) => e.employment_ended_date).length;

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p>Indlæser ansatte...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-auto md:pt-0 pt-16">
        <div className="p-4 md:p-8">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Ansatte</h1>
            <p className="text-muted-foreground">
              Håndter ansatte medarbejdere, performance og omsætning
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Aktive ansatte
                </CardTitle>
                <Users className="h-4 w-4 text-status-success" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-status-success">{activeCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Stoppede
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-muted-foreground">{stoppedCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Churn rate
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-status-rejected" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-status-rejected">
                  {employees.length > 0
                    ? Math.round((stoppedCount / employees.length) * 100)
                    : 0}
                  %
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mb-6 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg efter navn eller email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="active">Aktive</SelectItem>
                <SelectItem value="stopped">Stoppede</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterTeam} onValueChange={setFilterTeam}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Alle teams" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">Alle teams</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4">
            {filteredEmployees.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Ingen ansatte fundet
                </CardContent>
              </Card>
            ) : (
              filteredEmployees.map((emp) => {
                const hasOverdueRevenue = isRevenueOverdue(emp, 30) || isRevenueOverdue(emp, 60) || isRevenueOverdue(emp, 90);
                
                return (
                <Card key={emp.id} className={hasOverdueRevenue ? "border-destructive border-2" : ""}>
                  <CardContent className="p-6">
                    {emp.employment_ended_date && (
                      <div className="mb-4 p-3 bg-muted text-muted-foreground text-sm font-medium rounded flex items-center gap-2">
                        <Badge variant="outline" className="bg-status-rejected/10 text-status-rejected border-status-rejected/20">
                          Stoppet
                        </Badge>
                        <span>
                          {format(new Date(emp.employment_ended_date), "d. MMMM yyyy", { locale: da })}
                        </span>
                        {emp.employment_end_reason && (
                          <span className="text-xs">- {emp.employment_end_reason}</span>
                        )}
                      </div>
                    )}
                    {hasOverdueRevenue && (
                      <div className="mb-4 p-2 bg-destructive/10 text-destructive text-sm font-medium rounded flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Mangler dækningsbidrag data
                      </div>
                    )}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-semibold">
                            {emp.candidate.first_name} {emp.candidate.last_name}
                          </h3>
                        </div>

                        {/* Editable fields */}
                        <div className="space-y-2 mb-4">
                          {/* Status */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground w-20">Status:</span>
                            <Select
                              value={emp.employment_ended_date ? "stopped" : "ansat"}
                              onValueChange={(value) => {
                                if (value === "stopped" && !emp.employment_ended_date) {
                                  setSelectedEmployee(emp);
                                  setShowStopDialog(true);
                                } else if (value === "ansat") {
                                  handleStatusChange(emp.id, "ansat");
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 w-auto gap-2 border-0 bg-transparent p-0 focus:ring-0">
                                <SelectValue>
                                  {emp.employment_ended_date ? (
                                    <Badge variant="outline" className="bg-status-rejected/10 text-status-rejected border-status-rejected/20">
                                      Stoppet
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-status-success/10 text-status-success border-status-success/20">
                                      Ansat
                                    </Badge>
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-50">
                                <SelectItem value="ansat">Ansat</SelectItem>
                                <SelectItem value="stopped">Stoppet</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Team */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground w-20">Team:</span>
                            <Select
                              value={emp.team_id || "none"}
                              onValueChange={(value) => handleTeamChange(emp.id, value === "none" ? "" : value)}
                            >
                              <SelectTrigger className="h-8 w-auto gap-2 border-0 bg-transparent p-0 focus:ring-0">
                                <SelectValue>
                                  <Badge className="bg-primary/10 text-primary border-primary/20">
                                    {emp.team?.name || "Intet team"}
                                  </Badge>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-50">
                                <SelectItem value="none">Intet team</SelectItem>
                                {teams.map((team) => (
                                  <SelectItem key={team.id} value={team.id}>
                                    {team.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Sub-team (only for United) */}
                          {emp.team_id && emp.team?.name === "United" && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground w-20">Underteam:</span>
                              <Select
                                value={emp.sub_team || "none"}
                                onValueChange={(value) => handleSubTeamChange(emp.id, value === "none" ? "" : value)}
                              >
                                <SelectTrigger className="h-8 w-auto gap-2 border-0 bg-transparent p-0 focus:ring-0">
                                  <SelectValue>
                                    <Badge variant="outline">
                                      {emp.sub_team || "Intet underteam"}
                                    </Badge>
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="bg-popover z-50">
                                  <SelectItem value="none">Intet underteam</SelectItem>
                                  <SelectItem value="Tryg">Tryg</SelectItem>
                                  <SelectItem value="ASE">ASE</SelectItem>
                                  <SelectItem value="Finansforbundet">Finansforbundet</SelectItem>
                                  <SelectItem value="Business Danmark">Business Danmark</SelectItem>
                                  <SelectItem value="Codan">Codan</SelectItem>
                                  <SelectItem value="AKA">AKA</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Role */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground w-20">Stilling:</span>
                            <Select
                              value={emp.role}
                              onValueChange={(value) => handleRoleChange(emp.id, value)}
                            >
                              <SelectTrigger className="h-8 w-auto gap-2 border-0 bg-transparent p-0 focus:ring-0">
                                <SelectValue>
                                  <Badge variant="outline">{roleLabels[emp.role]}</Badge>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-50">
                                <SelectItem value="fieldmarketing">Fieldmarketing</SelectItem>
                                <SelectItem value="salgskonsulent">Salgskonsulent</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Hired Date */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground w-20">Ansat:</span>
                            <Input
                              type="date"
                              value={emp.hired_date}
                              onChange={(e) => handleHiredDateChange(emp.id, e.target.value)}
                              className="h-8 w-auto"
                            />
                          </div>
                        </div>

                        <div className="text-sm text-muted-foreground space-y-1 mb-3">
                          <div>Email: {emp.candidate.email}</div>
                          <div>Telefon: {emp.candidate.phone}</div>
                          {emp.employment_ended_date && (
                            <>
                              <div>
                                Stoppet: {format(new Date(emp.employment_ended_date), "d. MMMM yyyy", { locale: da })}
                              </div>
                              {emp.employment_end_reason && (
                                <div>Årsag: {emp.employment_end_reason}</div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Revenue summary on card */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div 
                            className={`p-2 rounded border cursor-pointer hover:opacity-80 transition-opacity ${isRevenueOverdue(emp, 30) ? 'bg-destructive/10 border-destructive' : 'bg-muted/50'}`}
                            onClick={() => {
                              setSelectedEmployee(emp);
                              fetchEmployeeDetails(emp.id);
                              setShowRevenueDialog(true);
                            }}
                          >
                            <div className="text-xs text-muted-foreground mb-1">30 dage</div>
                            <div className="font-semibold">
                              {getRevenueForPeriod(emp, 30) 
                                ? `${getRevenueForPeriod(emp, 30)!.revenue.toLocaleString()} kr`
                                : isRevenueOverdue(emp, 30) ? '⚠️ Mangler' : '-'
                              }
                            </div>
                          </div>
                          <div 
                            className={`p-2 rounded border cursor-pointer hover:opacity-80 transition-opacity ${isRevenueOverdue(emp, 60) ? 'bg-destructive/10 border-destructive' : 'bg-muted/50'}`}
                            onClick={() => {
                              setSelectedEmployee(emp);
                              fetchEmployeeDetails(emp.id);
                              setShowRevenueDialog(true);
                            }}
                          >
                            <div className="text-xs text-muted-foreground mb-1">60 dage</div>
                            <div className="font-semibold">
                              {getRevenueForPeriod(emp, 60) 
                                ? `${getRevenueForPeriod(emp, 60)!.revenue.toLocaleString()} kr`
                                : isRevenueOverdue(emp, 60) ? '⚠️ Mangler' : '-'
                              }
                            </div>
                          </div>
                          <div 
                            className={`p-2 rounded border cursor-pointer hover:opacity-80 transition-opacity ${isRevenueOverdue(emp, 90) ? 'bg-destructive/10 border-destructive' : 'bg-muted/50'}`}
                            onClick={() => {
                              setSelectedEmployee(emp);
                              fetchEmployeeDetails(emp.id);
                              setShowRevenueDialog(true);
                            }}
                          >
                            <div className="text-xs text-muted-foreground mb-1">90 dage</div>
                            <div className="font-semibold">
                              {getRevenueForPeriod(emp, 90) 
                                ? `${getRevenueForPeriod(emp, 90)!.revenue.toLocaleString()} kr`
                                : isRevenueOverdue(emp, 90) ? '⚠️ Mangler' : '-'
                              }
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedEmployee(emp);
                            fetchEmployeeDetails(emp.id);
                            setShowRevenueDialog(true);
                          }}
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Dækningsbidrag
                        </Button>
                        {!emp.employment_ended_date && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedEmployee(emp);
                              setShowStopDialog(true);
                            }}
                          >
                            Marker som stoppet
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )})
            )}
          </div>
        </div>
      </div>

      {/* Revenue Dialog */}
      <RevenueDialog
        open={showRevenueDialog}
        onOpenChange={setShowRevenueDialog}
        employee={selectedEmployee}
        revenueData={revenueData}
        performanceReviews={performanceReviews}
        onAddRevenue={handleAddRevenue}
      />

      {/* Stop Employee Dialog */}
      <StopEmployeeDialog
        open={showStopDialog}
        onOpenChange={setShowStopDialog}
        employee={selectedEmployee}
        onConfirm={handleStopEmployee}
      />
    </div>
  );
};

// Revenue Dialog Component
const RevenueDialog = ({
  open,
  onOpenChange,
  employee,
  revenueData,
  performanceReviews,
  onAddRevenue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  revenueData: RevenueData[];
  performanceReviews: PerformanceReview[];
  onAddRevenue: (employeeId: string, data: RevenueData) => void;
}) => {
  // Find existing revenue for each period
  const revenue30 = revenueData.find((r) => r.period === 30);
  const revenue60 = revenueData.find((r) => r.period === 60);
  const revenue90 = revenueData.find((r) => r.period === 90);

  const [day30Value, setDay30Value] = useState<number>(0);
  const [day60Value, setDay60Value] = useState<number>(0);
  const [day90Value, setDay90Value] = useState<number>(0);

  // Update local state when data changes
  useEffect(() => {
    setDay30Value(revenue30?.revenue || 0);
    setDay60Value(revenue60?.revenue || 0);
    setDay90Value(revenue90?.revenue || 0);
  }, [revenue30, revenue60, revenue90]);

  const handleSave = async (period: number, value: number) => {
    const existingRevenue = revenueData.find((r) => r.period === period);
    
    if (existingRevenue) {
      // Update existing
      const { error } = await supabase
        .from("revenue_data")
        .update({ revenue: value })
        .eq("id", existingRevenue.id);

      if (error) {
        toast.error("Kunne ikke opdatere dækningsbidrag");
        console.error(error);
      } else {
        toast.success("Dækningsbidrag opdateret!");
        onAddRevenue(employee!.id, { period, revenue: value }); // Trigger refresh
      }
    } else {
      // Insert new
      onAddRevenue(employee!.id, { period, revenue: value });
    }
  };

  const handleDelete = async (period: number) => {
    const existingRevenue = revenueData.find((r) => r.period === period);
    
    if (existingRevenue) {
      const { error } = await supabase
        .from("revenue_data")
        .delete()
        .eq("id", existingRevenue.id);

      if (error) {
        toast.error("Kunne ikke slette dækningsbidrag");
        console.error(error);
      } else {
        toast.success("Dækningsbidrag slettet!");
        onAddRevenue(employee!.id, { period, revenue: 0 }); // Trigger refresh
        
        // Reset local state
        if (period === 30) setDay30Value(0);
        if (period === 60) setDay60Value(0);
        if (period === 90) setDay90Value(0);
      }
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Dækningsbidrag & Performance - {employee.candidate.first_name}{" "}
            {employee.candidate.last_name}
          </DialogTitle>
          <DialogDescription>
            Administrer dækningsbidrag og se performance reviews
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Performance Reviews */}
          {performanceReviews.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Performance Reviews</h3>
              <div className="grid gap-3">
                {performanceReviews.map((review) => (
                  <div key={review.id} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{review.review_period} dage</Badge>
                      <Badge>{review.rating}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(review.review_date), "d. MMMM yyyy", { locale: da })}
                    </div>
                    {review.comments && (
                      <p className="text-sm mt-2">{review.comments}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revenue Entry Fields */}
          <div>
            <h3 className="font-semibold mb-4">Dækningsbidrag</h3>
            <div className="space-y-3">
              {/* 30 days */}
              <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-20 text-center">
                    <div className="text-2xl font-bold">30</div>
                    <div className="text-xs text-muted-foreground">dage</div>
                  </div>
                  <div className="flex-1">
                    <Input
                      type="number"
                      value={day30Value}
                      onChange={(e) => setDay30Value(parseFloat(e.target.value) || 0)}
                      placeholder="Indtast beløb"
                      className="text-lg font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSave(30, day30Value)}
                      disabled={day30Value === (revenue30?.revenue || 0)}
                    >
                      Gem
                    </Button>
                    {revenue30 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(30)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        Slet
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* 60 days */}
              <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-20 text-center">
                    <div className="text-2xl font-bold">60</div>
                    <div className="text-xs text-muted-foreground">dage</div>
                  </div>
                  <div className="flex-1">
                    <Input
                      type="number"
                      value={day60Value}
                      onChange={(e) => setDay60Value(parseFloat(e.target.value) || 0)}
                      placeholder="Indtast beløb"
                      className="text-lg font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSave(60, day60Value)}
                      disabled={day60Value === (revenue60?.revenue || 0)}
                    >
                      Gem
                    </Button>
                    {revenue60 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(60)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        Slet
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* 90 days */}
              <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-20 text-center">
                    <div className="text-2xl font-bold">90</div>
                    <div className="text-xs text-muted-foreground">dage</div>
                  </div>
                  <div className="flex-1">
                    <Input
                      type="number"
                      value={day90Value}
                      onChange={(e) => setDay90Value(parseFloat(e.target.value) || 0)}
                      placeholder="Indtast beløb"
                      className="text-lg font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSave(90, day90Value)}
                      disabled={day90Value === (revenue90?.revenue || 0)}
                    >
                      Gem
                    </Button>
                    {revenue90 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(90)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        Slet
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Total Summary */}
              {(revenue30 || revenue60 || revenue90) && (
                <div className="mt-6 pt-4 border-t">
                  <div className="flex items-center justify-between text-lg">
                    <span className="font-semibold">Total</span>
                    <span className="text-2xl font-bold text-primary">
                      {((revenue30?.revenue || 0) + (revenue60?.revenue || 0) + (revenue90?.revenue || 0)).toLocaleString()} kr
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Stop Employee Dialog Component
const StopEmployeeDialog = ({
  open,
  onOpenChange,
  employee,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onConfirm: (employeeId: string, endDate: string, reason: string) => void;
}) => {
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marker som stoppet</DialogTitle>
          <DialogDescription>
            Registrer stopdato og årsag for {employee.candidate.first_name}{" "}
            {employee.candidate.last_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Stopdato *</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>

          <div>
            <Label>Årsag *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="F.eks. Fandt andet job, flyttede, personlige årsager..."
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuller
            </Button>
            <Button
              onClick={() => {
                if (endDate && reason) {
                  onConfirm(employee.id, endDate, reason);
                } else {
                  toast.error("Udfyld venligst alle felter");
                }
              }}
            >
              Marker som stoppet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Employees;
