import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ApplicationCard } from "@/components/ApplicationCard";
import { Sidebar } from "@/components/Sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Plus } from "lucide-react";
import { toast } from "sonner";

interface Application {
  id: string;
  role: string;
  status: string;
  source?: string;
  deadline?: string;
  next_step?: string;
  responsible_user_id?: string;
  application_date: string;
  candidate: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

const Applications = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          *,
          candidate:candidates (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .order("application_date", { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error: any) {
      toast.error("Kunne ikke hente ansøgninger");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.candidate.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.candidate.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.candidate.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === "all" || app.role === roleFilter;
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p>Indlæser...</p>
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
            <h1 className="text-3xl font-bold mb-2">Indbakke</h1>
            <p className="text-muted-foreground">Håndter alle ansøgninger</p>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg efter navn eller email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Rolle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle roller</SelectItem>
                <SelectItem value="fieldmarketing">Fieldmarketing</SelectItem>
                <SelectItem value="salgskonsulent">Salgskonsulent</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle status</SelectItem>
                <SelectItem value="ny_ansoegning">Ny ansøgning</SelectItem>
                <SelectItem value="startet">Startet</SelectItem>
                <SelectItem value="udskudt_samtale">Udskudt samtale</SelectItem>
                <SelectItem value="ikke_kvalificeret">Ikke kvalificeret</SelectItem>
                <SelectItem value="ikke_ansat">Ikke ansat</SelectItem>
                <SelectItem value="ansat">Ansat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4">
            {filteredApplications.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Ingen ansøgninger fundet</p>
              </div>
            ) : (
              filteredApplications.map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  onClick={() => {
                    toast.info("Åbner ansøgningsdetaljer (kommer snart)");
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Applications;
