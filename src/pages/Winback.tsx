import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { CandidateCard } from "@/components/CandidateCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Device, Call } from "@twilio/voice-sdk";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Application {
  id: string;
  role: string;
  status: string;
  application_date: string;
  deadline?: string;
  next_step?: string;
  source?: string;
  team_id?: string;
  notes?: string;
}

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  notes?: string;
  created_at: string;
  first_viewed_at?: string | null;
}

interface CandidateWithApplications {
  candidate: Candidate;
  applications: Application[];
}

const Winback = () => {
  const [candidatesWithApps, setCandidatesWithApps] = useState<CandidateWithApplications[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [teams, setTeams] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<string>("newest");
  const [activeTab, setActiveTab] = useState<string>("ghostet");
  const [twilioDevice, setTwilioDevice] = useState<Device | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);

  useEffect(() => {
    fetchCandidates();
    fetchTeams();

    // Initialize Twilio Device
    const initializeTwilioDevice = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("twilio-voice-token");
        if (error) throw error;

        if (data?.token) {
          const device = new Device(data.token, {
            logLevel: 1,
            codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
          });

          device.on("registered", () => {
            console.log("Twilio Device registered");
          });

          device.on("error", (error) => {
            console.error("Twilio Device error:", error);
            toast.error("Telefonfejl: " + error.message);
          });

          device.on("incoming", (call) => {
            console.log("Incoming call:", call);
            toast.info("Indgående opkald");
          });

          await device.register();
          deviceRef.current = device;
          setTwilioDevice(device);
        }
      } catch (err: any) {
        console.error("Error initializing Twilio Device:", err);
      }
    };

    initializeTwilioDevice();

    // Set up realtime subscription
    const channel = supabase
      .channel('winback-candidates-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications'
        },
        () => {
          fetchCandidates();
        }
      )
      .subscribe();

    return () => {
      if (activeCall) {
        activeCall.disconnect();
      }
      if (twilioDevice) {
        twilioDevice.destroy();
      }
      supabase.removeChannel(channel);
    };
  }, [activeTab]);

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching teams:", error);
      return;
    }

    setTeams(data || []);
  };

  const fetchCandidates = async () => {
    try {
      setLoading(true);

      // Fetch applications with the current status filter
      const { data: applications, error: appsError } = await supabase
        .from("applications")
        .select("*")
        .eq("status", activeTab as "ghostet" | "takket_nej" | "interesseret_i_kundeservice")
        .order("application_date", { ascending: false });

      if (appsError) throw appsError;

      // Get unique candidate IDs
      const candidateIds = [...new Set(applications?.map(app => app.candidate_id) || [])];

      if (candidateIds.length === 0) {
        setCandidatesWithApps([]);
        setLoading(false);
        return;
      }

      // Fetch candidates
      const { data: candidates, error: candidatesError } = await supabase
        .from("candidates")
        .select("*")
        .in("id", candidateIds);

      if (candidatesError) throw candidatesError;

      // Group applications by candidate
      const candidatesMap = new Map<string, CandidateWithApplications>();
      
      candidates?.forEach(candidate => {
        candidatesMap.set(candidate.id, {
          candidate,
          applications: []
        });
      });

      applications?.forEach(app => {
        const candidateData = candidatesMap.get(app.candidate_id);
        if (candidateData) {
          candidateData.applications.push(app);
        }
      });

      setCandidatesWithApps(Array.from(candidatesMap.values()));
    } catch (error: any) {
      console.error("Error fetching candidates:", error);
      toast.error("Fejl ved indlæsning af kandidater");
    } finally {
      setLoading(false);
    }
  };

  const filteredCandidates = candidatesWithApps.filter((item) => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${item.candidate.first_name} ${item.candidate.last_name}`.toLowerCase();
    return (
      fullName.includes(searchLower) ||
      item.candidate.email.toLowerCase().includes(searchLower) ||
      item.candidate.phone.includes(searchTerm)
    );
  });

  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    const latestAppA = a.applications[0];
    const latestAppB = b.applications[0];

    switch (sortBy) {
      case "newest":
        return new Date(latestAppB.application_date).getTime() - new Date(latestAppA.application_date).getTime();
      case "oldest":
        return new Date(latestAppA.application_date).getTime() - new Date(latestAppB.application_date).getTime();
      case "name":
        return `${a.candidate.first_name} ${a.candidate.last_name}`.localeCompare(
          `${b.candidate.first_name} ${b.candidate.last_name}`
        );
      default:
        return 0;
    }
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden md:ml-0 mt-16 md:mt-0">
        <div className="p-4 md:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Winback kandidater</h1>
              <p className="text-muted-foreground">
                Kandidater der har ghostet eller takket nej - klar til winback
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full max-w-2xl grid-cols-3">
                <TabsTrigger value="ghostet">Ghostet</TabsTrigger>
                <TabsTrigger value="takket_nej">Takket nej</TabsTrigger>
                <TabsTrigger value="interesseret_i_kundeservice">Interesseret i kundeservice</TabsTrigger>
              </TabsList>

              <div className="mt-6 space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Søg efter navn, email eller telefon..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="flex gap-2">
                    <div className="w-full md:w-48">
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sorter efter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Nyeste først</SelectItem>
                          <SelectItem value="oldest">Ældste først</SelectItem>
                          <SelectItem value="name">Navn (A-Å)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <TabsContent value="ghostet" className="mt-0">
                  {loading ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">Indlæser kandidater...</p>
                    </div>
                  ) : sortedCandidates.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">
                        {searchTerm 
                          ? "Ingen kandidater matchede din søgning" 
                          : "Ingen ghostede kandidater endnu"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sortedCandidates.map((item) => (
                        <CandidateCard
                          key={item.candidate.id}
                          candidate={item.candidate}
                          applications={item.applications}
                          teams={teams}
                          onUpdate={fetchCandidates}
                          deviceRef={deviceRef}
                          callRef={callRef}
                          activeCall={activeCall}
                          setActiveCall={setActiveCall}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="takket_nej" className="mt-0">
                  {loading ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">Indlæser kandidater...</p>
                    </div>
                  ) : sortedCandidates.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">
                        {searchTerm 
                          ? "Ingen kandidater matchede din søgning" 
                          : "Ingen kandidater der har takket nej endnu"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sortedCandidates.map((item) => (
                        <CandidateCard
                          key={item.candidate.id}
                          candidate={item.candidate}
                          applications={item.applications}
                          teams={teams}
                          onUpdate={fetchCandidates}
                          deviceRef={deviceRef}
                          callRef={callRef}
                          activeCall={activeCall}
                          setActiveCall={setActiveCall}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="interesseret_i_kundeservice" className="mt-0">
                  {loading ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">Indlæser kandidater...</p>
                    </div>
                  ) : sortedCandidates.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">
                        {searchTerm 
                          ? "Ingen kandidater matchede din søgning" 
                          : "Ingen kandidater interesseret i kundeservice endnu"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sortedCandidates.map((item) => (
                        <CandidateCard
                          key={item.candidate.id}
                          candidate={item.candidate}
                          applications={item.applications}
                          teams={teams}
                          onUpdate={fetchCandidates}
                          deviceRef={deviceRef}
                          callRef={callRef}
                          activeCall={activeCall}
                          setActiveCall={setActiveCall}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Winback;
