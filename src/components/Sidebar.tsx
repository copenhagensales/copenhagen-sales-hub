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
  MessageSquare
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export const Sidebar = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();

    // Subscribe to changes in communication_logs
    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/candidates", icon: Users, label: "Kandidater" },
    { to: "/employees", icon: Briefcase, label: "Ansatte" },
    { to: "/messages", icon: MessageSquare, label: "Beskeder", badge: unreadCount },
    { to: "/pipeline", icon: Kanban, label: "Pipeline" },
    { to: "/reports", icon: BarChart3, label: "Rapporter" },
  ];

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-sidebar-foreground">
          Copenhagen Sales GPT
        </h1>
        <p className="text-sm text-sidebar-foreground/70">ATS System</p>
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
        <h1 className="ml-4 text-lg font-bold text-sidebar-foreground">
          Copenhagen Sales GPT
        </h1>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border">
        <SidebarContent />
      </div>
    </>
  );
};
