import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users2, ChevronDown, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Team {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface SubTeam {
  id: string;
  team_id: string;
  name: string;
  created_at: string;
}

interface TeamWithCount extends Team {
  employee_count: number;
  sub_teams: SubTeam[];
}

const Teams = () => {
  const [teams, setTeams] = useState<TeamWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  
  // Sub-team dialog state
  const [isSubTeamDialogOpen, setIsSubTeamDialogOpen] = useState(false);
  const [editingSubTeam, setEditingSubTeam] = useState<SubTeam | null>(null);
  const [subTeamFormData, setSubTeamFormData] = useState({ name: "", teamId: "" });

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("*")
      .order("name");

    if (teamsError) {
      toast.error("Kunne ikke hente teams");
      return;
    }

    // Fetch sub-teams
    const { data: subTeamsData, error: subTeamsError } = await supabase
      .from("sub_teams")
      .select("*")
      .order("name");

    if (subTeamsError) {
      console.error("Error fetching sub-teams:", subTeamsError);
    }

    // Fetch employee counts per team
    const { data: employeeCounts, error: countError } = await supabase
      .from("applications")
      .select("team_id")
      .eq("status", "ansat")
      .not("team_id", "is", null);

    if (countError) {
      console.error("Error fetching employee counts:", countError);
    }

    // Count employees per team
    const countMap = new Map<string, number>();
    employeeCounts?.forEach((app) => {
      if (app.team_id) {
        countMap.set(app.team_id, (countMap.get(app.team_id) || 0) + 1);
      }
    });

    // Group sub-teams by team
    const subTeamsByTeam = new Map<string, SubTeam[]>();
    subTeamsData?.forEach((subTeam) => {
      const existing = subTeamsByTeam.get(subTeam.team_id) || [];
      subTeamsByTeam.set(subTeam.team_id, [...existing, subTeam]);
    });

    const teamsWithCounts: TeamWithCount[] = (teamsData || []).map((team) => ({
      ...team,
      employee_count: countMap.get(team.id) || 0,
      sub_teams: subTeamsByTeam.get(team.id) || [],
    }));

    setTeams(teamsWithCounts);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Navn er påkrævet");
      return;
    }

    if (editingTeam) {
      const { error } = await supabase
        .from("teams")
        .update({
          name: formData.name,
          description: formData.description || null,
        })
        .eq("id", editingTeam.id);

      if (error) {
        toast.error("Kunne ikke opdatere team");
        return;
      }

      toast.success("Team opdateret");
    } else {
      const { error } = await supabase.from("teams").insert({
        name: formData.name,
        description: formData.description || null,
      });

      if (error) {
        toast.error("Kunne ikke oprette team");
        return;
      }

      toast.success("Team oprettet");
    }

    setIsDialogOpen(false);
    setEditingTeam(null);
    setFormData({ name: "", description: "" });
    fetchTeams();
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (teamId: string) => {
    const { error } = await supabase.from("teams").delete().eq("id", teamId);

    if (error) {
      toast.error("Kunne ikke slette team");
      return;
    }

    toast.success("Team slettet");
    fetchTeams();
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingTeam(null);
    setFormData({ name: "", description: "" });
  };

  // Sub-team handlers
  const handleAddSubTeam = (teamId: string) => {
    setEditingSubTeam(null);
    setSubTeamFormData({ name: "", teamId });
    setIsSubTeamDialogOpen(true);
  };

  const handleEditSubTeam = (subTeam: SubTeam) => {
    setEditingSubTeam(subTeam);
    setSubTeamFormData({ name: subTeam.name, teamId: subTeam.team_id });
    setIsSubTeamDialogOpen(true);
  };

  const handleSubTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subTeamFormData.name.trim()) {
      toast.error("Navn er påkrævet");
      return;
    }

    if (editingSubTeam) {
      const { error } = await supabase
        .from("sub_teams")
        .update({ name: subTeamFormData.name })
        .eq("id", editingSubTeam.id);

      if (error) {
        toast.error("Kunne ikke opdatere sub-team");
        return;
      }

      toast.success("Sub-team opdateret");
    } else {
      const { error } = await supabase.from("sub_teams").insert({
        name: subTeamFormData.name,
        team_id: subTeamFormData.teamId,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Sub-team med dette navn findes allerede");
        } else {
          toast.error("Kunne ikke oprette sub-team");
        }
        return;
      }

      toast.success("Sub-team oprettet");
    }

    setIsSubTeamDialogOpen(false);
    setEditingSubTeam(null);
    setSubTeamFormData({ name: "", teamId: "" });
    fetchTeams();
  };

  const handleDeleteSubTeam = async (subTeamId: string) => {
    const { error } = await supabase.from("sub_teams").delete().eq("id", subTeamId);

    if (error) {
      toast.error("Kunne ikke slette sub-team");
      return;
    }

    toast.success("Sub-team slettet");
    fetchTeams();
  };

  const toggleTeamExpanded = (teamId: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 mt-16 md:mt-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Teams</h1>
              <p className="text-muted-foreground mt-1">
                Administrer teams og sub-teams til ansættelser
              </p>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingTeam(null);
                  setFormData({ name: "", description: "" });
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tilføj team
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingTeam ? "Rediger team" : "Tilføj nyt team"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Navn *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="f.eks. TDC Erhverv"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Beskrivelse</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Valgfri beskrivelse af teamet"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDialogClose}
                    >
                      Annuller
                    </Button>
                    <Button type="submit">
                      {editingTeam ? "Gem ændringer" : "Opret team"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Sub-team Dialog */}
            <Dialog open={isSubTeamDialogOpen} onOpenChange={setIsSubTeamDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingSubTeam ? "Rediger sub-team" : "Tilføj sub-team"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubTeamSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="subTeamName">Navn *</Label>
                    <Input
                      id="subTeamName"
                      value={subTeamFormData.name}
                      onChange={(e) =>
                        setSubTeamFormData({ ...subTeamFormData, name: e.target.value })
                      }
                      placeholder="f.eks. Tryg"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsSubTeamDialogOpen(false);
                        setEditingSubTeam(null);
                        setSubTeamFormData({ name: "", teamId: "" });
                      }}
                    >
                      Annuller
                    </Button>
                    <Button type="submit">
                      {editingSubTeam ? "Gem ændringer" : "Opret sub-team"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Indlæser teams...
            </div>
          ) : teams.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Ingen teams oprettet endnu
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Klik på "Tilføj team" for at oprette dit første team
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {teams.map((team) => (
                <Card key={team.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          {team.sub_teams.length > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 -ml-1"
                              onClick={() => toggleTeamExpanded(team.id)}
                            >
                              {expandedTeams.has(team.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <h3 className="font-semibold text-foreground">
                            {team.name}
                          </h3>
                          <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {team.employee_count} {team.employee_count === 1 ? "ansat" : "ansatte"}
                          </span>
                          {team.sub_teams.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {team.sub_teams.length} sub-teams
                            </Badge>
                          )}
                        </div>
                        {team.description && (
                          <p className="text-sm text-muted-foreground mt-1 ml-5">
                            {team.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddSubTeam(team.id)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Sub-team
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(team)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Slet team?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Er du sikker på, at du vil slette "{team.name}"?
                                {team.sub_teams.length > 0 && (
                                  <span className="block mt-2 font-medium">
                                    Dette vil også slette {team.sub_teams.length} sub-teams.
                                  </span>
                                )}
                                Dette kan ikke fortrydes.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuller</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(team.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Slet
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    {/* Sub-teams list */}
                    {team.sub_teams.length > 0 && expandedTeams.has(team.id) && (
                      <div className="mt-4 ml-5 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Sub-teams
                        </p>
                        <div className="grid gap-2">
                          {team.sub_teams.map((subTeam) => (
                            <div
                              key={subTeam.id}
                              className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                            >
                              <span className="text-sm">{subTeam.name}</span>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEditSubTeam(subTeam)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Slet sub-team?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Er du sikker på, at du vil slette "{subTeam.name}"?
                                        Dette kan ikke fortrydes.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuller</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteSubTeam(subTeam.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Slet
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Teams;
