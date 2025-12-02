import { useState, useEffect } from "react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  Kanban, 
  BarChart3, 
  LogOut,
  Briefcase,
  Menu,
  X,
  MessageSquare,
  CalendarCheck,
  Shield,
  MessageCircle,
  Mail,
  RotateCcw,
  Users2
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logo from "@/assets/cph-sales-logo.png";

export const Sidebar = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newCandidatesCount, setNewCandidatesCount] = useState(0);
  const [winbackCount, setWinbackCount] = useState(0);
  const [overdueContributionCount, setOverdueContributionCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchUnreadCount();
    fetchNewCandidatesCount();
    fetchWinbackCount();
    fetchOverdueContributionCount();
    checkAdminRole();

    // Subscribe to changes in communication_logs
    const messagesChannel = supabase
      .channel('unread-messages-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'communication_logs',
          filter: 'direction=eq.inbound'
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    // Subscribe to changes in applications
    const applicationsChannel = supabase
      .channel('new-applications-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications'
        },
        () => {
          fetchNewCandidatesCount();
          fetchWinbackCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(applicationsChannel);
    };
  }, []);

  const fetchUnreadCount = async () => {
    const { count } = await supabase
      .from('communication_logs')
      .select('*', { count: 'exact', head: true })
      .eq('direction', 'inbound')
      .eq('read', false)
      .in('type', ['sms', 'email']);

    setUnreadCount(count || 0);
  };

  const fetchNewCandidatesCount = async () => {
    const { count } = await supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ny_ansoegning');

    setNewCandidatesCount(count || 0);
  };

  const fetchWinbackCount = async () => {
    const { count } = await supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .in('status', ['ghostet', 'takket_nej', 'interesseret_i_kundeservice']);

    setWinbackCount(count || 0);
  };

  const fetchOverdueContributionCount = async () => {
    // Fetch hired employees with their contribution margin data
    const { data: hiredApplications } = await supabase
      .from('applications')
      .select(`
        id,
        hired_date,
        revenue_data (period, revenue)
      `)
      .eq('status', 'ansat')
      .not('hired_date', 'is', null);

    if (!hiredApplications) {
      setOverdueContributionCount(0);
      return;
    }

    const today = new Date();
    let overdueCount = 0;

    hiredApplications.forEach((app: any) => {
      if (!app.hired_date) return;
      
      const hiredDate = new Date(app.hired_date);
      const daysSinceHire = Math.floor((today.getTime() - hiredDate.getTime()) / (1000 * 60 * 60 * 24));
      
      const revenueData = app.revenue_data || [];
      const periods = revenueData.map((r: any) => r.period);
      
      // Check each period
      if (daysSinceHire >= 30 && !periods.includes(30)) overdueCount++;
      if (daysSinceHire >= 60 && !periods.includes(60)) overdueCount++;
      if (daysSinceHire >= 90 && !periods.includes(90)) overdueCount++;
    });

    setOverdueContributionCount(overdueCount);
  };

  const checkAdminRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    setIsAdmin(!!data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/candidates", icon: Users, label: "Kandidater", badge: newCandidatesCount },
    { to: "/messages", icon: MessageSquare, label: "Beskeder", badge: unreadCount },
    { to: "/employees", icon: Briefcase, label: "Ansatte", badge: overdueContributionCount },
    { to: "/upcoming-hires", icon: CalendarCheck, label: "Kommende ansættelser" },
    { to: "/winback", icon: RotateCcw, label: "Winback", badge: winbackCount },
    { to: "/reports", icon: BarChart3, label: "Rapporter" },
  ];

  const adminNavItems = [
    { to: "/teams", icon: Users2, label: "Teams" },
    { to: "/sms-templates", icon: MessageCircle, label: "SMS-skabeloner" },
    { to: "/email-templates", icon: Mail, label: "Email-skabeloner" },
    { to: "/admin", icon: Shield, label: "Admin" },
  ];

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-sidebar-border">
        <img src={logo} alt="Copenhagen Sales" className="h-16 w-auto" />
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium"
            onClick={() => setOpen(false)}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {item.badge}
              </Badge>
            )}
          </NavLink>
        ))}
        
        {isAdmin && (
          <>
            {adminNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent transition-colors"
                activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium"
                onClick={() => setOpen(false)}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={handleLogout}
        >
          <LogOut className="mr-3 h-5 w-5" />
          Log ud
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Header with Menu Button */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar border-b border-sidebar-border z-40 flex items-center px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar">
            <div className="flex h-full flex-col">
              <SidebarContent />
            </div>
          </SheetContent>
        </Sheet>
        <img src={logo} alt="Copenhagen Sales" className="ml-4 h-10 w-auto" />
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border">
        <SidebarContent />
      </div>
    </>
  );
};
