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
import { Search, TrendingUp, TrendingDown, DollarSign, Calendar, Users } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";

interface Employee {
  id: string;
  candidate_id: string;
  role: string;
  team_id: string;
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
      setEmployees(data || []);
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

  const roleLabels: Record<string, string> = {
    fieldmarketing: "Fieldmarketing",
    salgskonsulent: "Salgskonsulent",
  };

  const filteredEmployees = employees.filter((emp) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      emp.candidate.first_name.toLowerCase().includes(searchLower) ||
      emp.candidate.last_name.toLowerCase().includes(searchLower) ||
      emp.candidate.email.toLowerCase().includes(searchLower);

    const matchesTeam = filterTeam === "all" || emp.team_id === filterTeam;

    return matchesSearch && matchesTeam;
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
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Ansatte</h1>
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
              filteredEmployees.map((emp) => (
                <Card key={emp.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">
                            {emp.candidate.first_name} {emp.candidate.last_name}
                          </h3>
                          <Badge variant="outline">{roleLabels[emp.role]}</Badge>
                          {emp.team && (
                            <Badge className="bg-primary/10 text-primary border-primary/20">
                              {emp.team.name}
                            </Badge>
                          )}
                          {emp.employment_ended_date ? (
                            <Badge variant="outline" className="bg-status-rejected/10 text-status-rejected border-status-rejected/20">
                              Stoppet
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-status-success/10 text-status-success border-status-success/20">
                              Ansat
                            </Badge>
                          )}
                        </div>

                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>Email: {emp.candidate.email}</div>
                          <div>Telefon: {emp.candidate.phone}</div>
                          <div>
                            Ansat: {format(new Date(emp.hired_date), "d. MMMM yyyy", { locale: da })}
                          </div>
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
                      </div>

                      <div className="flex gap-2">
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
                            <Calendar className="h-4 w-4 mr-1" />
                            Marker som stoppet
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
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
            <h3 className="font-semibold mb-4 text-lg">Dækningsbidrag</h3>
            <div className="grid gap-3">
              {/* 30 days */}
              <Card className="p-4 bg-gradient-to-r from-primary/5 to-transparent border-l-4 border-l-primary">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Første måned</div>
                    <div className="text-lg font-bold">30 dage</div>
                  </div>
                  {revenue30 && (
                    <Badge variant="outline" className="bg-primary/10">
                      Gemt
                    </Badge>
                  )}
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-2 block">Beløb</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={day30Value}
                        onChange={(e) => setDay30Value(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="pr-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kr</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleSave(30, day30Value)}
                    disabled={day30Value === (revenue30?.revenue || 0)}
                    className="shrink-0"
                  >
                    Gem
                  </Button>
                  {revenue30 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(30)}
                      className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <span className="sr-only">Slet</span>
                      ×
                    </Button>
                  )}
                </div>
              </Card>

              {/* 60 days */}
              <Card className="p-4 bg-gradient-to-r from-secondary/5 to-transparent border-l-4 border-l-secondary">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Anden måned</div>
                    <div className="text-lg font-bold">60 dage</div>
                  </div>
                  {revenue60 && (
                    <Badge variant="outline" className="bg-secondary/10">
                      Gemt
                    </Badge>
                  )}
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-2 block">Beløb</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={day60Value}
                        onChange={(e) => setDay60Value(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="pr-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kr</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleSave(60, day60Value)}
                    disabled={day60Value === (revenue60?.revenue || 0)}
                    className="shrink-0"
                  >
                    Gem
                  </Button>
                  {revenue60 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(60)}
                      className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <span className="sr-only">Slet</span>
                      ×
                    </Button>
                  )}
                </div>
              </Card>

              {/* 90 days */}
              <Card className="p-4 bg-gradient-to-r from-accent/5 to-transparent border-l-4 border-l-accent">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Tredje måned</div>
                    <div className="text-lg font-bold">90 dage</div>
                  </div>
                  {revenue90 && (
                    <Badge variant="outline" className="bg-accent/10">
                      Gemt
                    </Badge>
                  )}
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-2 block">Beløb</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={day90Value}
                        onChange={(e) => setDay90Value(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="pr-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kr</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleSave(90, day90Value)}
                    disabled={day90Value === (revenue90?.revenue || 0)}
                    className="shrink-0"
                  >
                    Gem
                  </Button>
                  {revenue90 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(90)}
                      className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <span className="sr-only">Slet</span>
                      ×
                    </Button>
                  )}
                </div>
              </Card>

              {/* Total Summary */}
              {(revenue30 || revenue60 || revenue90) && (
                <Card className="p-4 bg-muted/30 border-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total dækningsbidrag</span>
                    <span className="text-2xl font-bold text-primary">
                      {((revenue30?.revenue || 0) + (revenue60?.revenue || 0) + (revenue90?.revenue || 0)).toLocaleString()} kr
                    </span>
                  </div>
                </Card>
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
