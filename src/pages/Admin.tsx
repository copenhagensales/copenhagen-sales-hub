import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, Shield, Users, Trash2, Upload } from "lucide-react";
import { BulkImportDialog } from "@/components/BulkImportDialog";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  roles: string[];
}

export default function Admin() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("hiring_manager");
  const [inviting, setInviting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Combine profiles with their roles
      const usersWithRoles = profiles?.map((profile) => ({
        ...profile,
        roles: roles?.filter((r) => r.user_id === profile.id).map((r) => r.role) || [],
      })) || [];

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Kunne ikke hente brugere");
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail) {
      toast.error("Email er påkrævet");
      return;
    }

    try {
      setInviting(true);
      
      // Generate a temporary password
      const tempPassword = Math.random().toString(36).slice(-8) + "Aa1!";

      // Create the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: inviteEmail,
        password: tempPassword,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("Bruger ikke oprettet");
      }

      // Assign the role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          role: inviteRole as "admin" | "hiring_manager" | "interviewer",
        });

      if (roleError) throw roleError;

      toast.success(`Bruger inviteret! Midlertidig adgangskode: ${tempPassword}\n\nBrugeren skal bekræfte deres email før login.`);
      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteRole("hiring_manager");
      fetchUsers();
    } catch (error: any) {
      console.error("Error inviting user:", error);
      toast.error(error.message || "Kunne ikke invitere bruger");
    } finally {
      setInviting(false);
    }
  };

  const handleToggleRole = async (userId: string, role: "admin" | "hiring_manager" | "interviewer", hasRole: boolean) => {
    try {
      if (hasRole) {
        // Remove role
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role);

        if (error) throw error;
        toast.success("Rolle fjernet");
      } else {
        // Add role
        const { error } = await supabase
          .from("user_roles")
          .insert({
            user_id: userId,
            role: role,
          });

        if (error) throw error;
        toast.success("Rolle tildelt");
      }

      fetchUsers();
    } catch (error: any) {
      console.error("Error toggling role:", error);
      toast.error("Kunne ikke opdatere rolle");
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Er du sikker på, at du vil slette brugeren ${userEmail}?`)) {
      return;
    }

    try {
      // Delete user roles first
      const { error: rolesError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (rolesError) throw rolesError;

      // Delete profile
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (profileError) throw profileError;

      toast.success("Bruger slettet");
      fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error("Kunne ikke slette bruger");
    }
  };

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    hiring_manager: "Hiring Manager",
    interviewer: "Interviewer",
  };

  const roleColors: Record<string, string> = {
    admin: "bg-destructive text-destructive-foreground",
    hiring_manager: "bg-primary text-primary-foreground",
    interviewer: "bg-secondary text-secondary-foreground",
  };

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 overflow-auto pt-16 md:pt-0">
          <div className="p-8">
            <p className="text-muted-foreground">Indlæser...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 overflow-auto pt-16 md:pt-0">
        <div className="p-4 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6 md:h-8 md:w-8" />
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Administrer brugere og roller
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setShowImportDialog(true)} variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Bulk Import
              </Button>

              <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Inviter bruger
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Inviter ny bruger</DialogTitle>
                  <DialogDescription>
                    Brugeren vil modtage en bekræftelses-email og skal oprette en adgangskode ved første login.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="bruger@eksempel.dk"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="role">Rolle</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
                        <SelectItem value="interviewer">Interviewer</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleInviteUser}
                    disabled={inviting || !inviteEmail}
                    className="w-full"
                  >
                    {inviting ? "Inviterer..." : "Send invitation"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          <BulkImportDialog
            open={showImportDialog}
            onOpenChange={setShowImportDialog}
            onSuccess={fetchUsers}
          />

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total brugere
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{users.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Admins
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">
                    {users.filter((u) => u.roles.includes("admin")).length}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Hiring Managers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">
                    {users.filter((u) => u.roles.includes("hiring_manager")).length}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Users List */}
          <Card>
            <CardHeader>
              <CardTitle>Brugere</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg gap-4"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{user.full_name || "Ikke angivet"}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <Badge
                              key={role}
                              className={roleColors[role]}
                            >
                              {roleLabels[role]}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline">Ingen roller</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                      <div className="flex flex-wrap gap-2">
                        {(["admin", "hiring_manager", "interviewer"] as const).map((role) => (
                          <Button
                            key={role}
                            size="sm"
                            variant={user.roles.includes(role) ? "default" : "outline"}
                            onClick={() =>
                              handleToggleRole(user.id, role, user.roles.includes(role))
                            }
                          >
                            {user.roles.includes(role) ? "Fjern" : "Tilføj"} {roleLabels[role]}
                          </Button>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteUser(user.id, user.email)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Slet
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
