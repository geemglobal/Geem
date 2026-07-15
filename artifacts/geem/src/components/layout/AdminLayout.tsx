import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Package, ShoppingCart, FileText, Users, Store,
  ClipboardList, Truck, Wrench, MessageSquare, Lock,
  BarChart3, Settings, Database, Globe, LogOut, ChevronDown, ChevronRight, Eye, Shield, History,
  Hash, Wallet, Menu, WifiOff, X, Receipt, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { axiosInstance } from "@/lib/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { Download } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { AppSetupPrompt } from "@/components/AppSetupPrompt";

const NAV_GROUPS = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/pos", label: "Point of Sale", icon: ShoppingCart },
    ],
  },
  {
    label: "Inventory & Sales",
    items: [
      { href: "/inventory", label: "Inventory", icon: Package },
      { href: "/invoices", label: "Invoices", icon: FileText },
      { href: "/quotations", label: "Quotations", icon: ClipboardList },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/service-tickets", label: "Service Tickets", icon: Wrench },
      { href: "/chat", label: "Live Chat", icon: MessageSquare },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/wallet", label: "Wallet Management", icon: Wallet },
      { href: "/expenses", label: "Expenses", icon: Receipt },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Online Shop",
    items: [
      { href: "/products", label: "Product Catalog", icon: Store },
      { href: "/shop-orders", label: "Web Orders", icon: Globe },
      { href: "/shipments", label: "Courier Center", icon: Truck },
    ],
  },
  {
    label: "Procurement",
    items: [
      { href: "/procurement", label: "Procurement", icon: ClipboardList },
    ],
  },
  {
    label: "Config & Tools",
    items: [
      { href: "/activity-log", label: "Activity Log", icon: History },
      { href: "/visitors", label: "Visitors", icon: Eye },
      { href: "/imei-management", label: "IMEI Generator", icon: Hash },
      { href: "/vault", label: "Platform Vault", icon: Lock },
      { href: "/master-data", label: "Master Data", icon: Database },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/system", label: "System", icon: Shield },
    ],
  },
];

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link href={href} onClick={onNavigate}>
      <div
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors",
          active
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{label}</span>
      </div>
    </Link>
  );
}

function SidebarContent({
  location,
  collapsedGroups,
  toggleGroup,
  user,
  onNavigate,
  handleLogout,
  logo,
}: {
  location: string;
  collapsedGroups: Set<string>;
  toggleGroup: (label: string) => void;
  user: { name: string; email: string };
  onNavigate?: () => void;
  handleLogout: () => void;
  logo?: string | null;
}) {
  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-4 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <img
            src={logo ?? "/favicon.svg"}
            alt="Logo"
            className="h-8 w-8 rounded-lg object-contain flex-shrink-0 bg-primary"
          />
          <div>
            <p className="font-bold text-sm leading-none">Geem CRM</p>
            <p className="text-xs text-sidebar-foreground/60 mt-0.5">Management System</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <button
              onClick={() => toggleGroup(group.label)}
              className="flex items-center justify-between w-full px-2 py-1 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider hover:text-sidebar-foreground/80 transition-colors"
            >
              <span>{group.label}</span>
              {collapsedGroups.has(group.label) ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
            {!collapsedGroups.has(group.label) && (
              <div className="mt-1 space-y-0.5">
                {group.items.map((item) => (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={
                      location === item.href ||
                      (item.href !== "/" && location.startsWith(item.href))
                    }
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-sidebar-border flex-shrink-0">
        <Link href="/shop" onClick={onNavigate}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer transition-colors">
            <Store className="h-4 w-4" />
            <span>View Shop</span>
          </div>
        </Link>
      </div>

      <div className="p-3 border-t border-sidebar-border flex-shrink-0">
        <div className="flex items-center justify-between px-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{user.email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground h-8 w-8 p-0 flex-shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, error: meError } = useGetMe({
    query: {
      queryKey: ["me"],
      retry: (failureCount, err) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 3;
      },
      retryDelay: 1500,
      staleTime: 5 * 60 * 1000,
    },
  });
  const { data: company } = useQuery<{ logo: string | null; companyName: string }>({
    queryKey: ["company-settings-logo"],
    queryFn: () => axiosInstance.get("/settings/company").then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const qc = useQueryClient();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isOnline = useOnlineStatus();

  const { data: bellCount = 0 } = useQuery<number>({
    queryKey: ["notif-bell-count"],
    queryFn: async () => {
      const [orders, returns] = await Promise.all([
        axiosInstance.get<{ orders: { id: number }[] }>("/web-orders?status=new").then(r => r.data.orders.length),
        axiosInstance.get<{ id: number; status: string }[]>("/web-orders/returns?status=pending").then(r => r.data.length),
      ]);
      return orders + returns;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const [offlineDismissed, setOfflineDismissed] = useState(false);
  const { canInstall, install } = usePwaInstall();

  usePushNotifications({
    authHeader: () => {
      const token = localStorage.getItem("geem_token");
      return token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>);
    },
    userType: "admin",
    userId: user?.email ?? undefined,
  });

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      const status = (meError as { response?: { status?: number } } | null)?.response?.status;
      // Only redirect if explicitly unauthorised (401/403), or if there was no error at all
      // (no token present). Never redirect on network errors or server restarts (5xx).
      if (!meError || status === 401 || status === 403) {
        setLocation("/login");
      }
    }
  }, [isLoading, user, meError, setLocation]);

  useEffect(() => {
    if (isOnline) setOfflineDismissed(false);
  }, [isOnline]);

  async function handleLogout() {
    try {
      await axiosInstance.post("/auth/logout");
    } catch {}
    localStorage.removeItem("geem_token");
    qc.clear();
    setLocation("/login");
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-muted-foreground">Redirecting...</div>
      </div>
    );
  }

  const pageTitle =
    location.split("/")[1]?.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) ||
    "Dashboard";

  const sidebarProps = {
    location,
    collapsedGroups,
    toggleGroup,
    user,
    handleLogout,
    logo: company?.logo ?? null,
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {!isOnline && !offlineDismissed && (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm z-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">You&apos;re offline.</span>
            <span className="hidden sm:inline opacity-90">
              Showing cached data — changes will not save until connection is restored.
            </span>
          </div>
          <button
            onClick={() => setOfflineDismissed(true)}
            className="hover:opacity-80 transition-opacity flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:flex w-60 flex-col flex-shrink-0 border-r border-sidebar-border overflow-hidden">
          <SidebarContent {...sidebarProps} />
        </aside>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="p-0 w-64 border-r-0">
            <SidebarContent
              {...sidebarProps}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border bg-card flex items-center px-3 sm:px-4 justify-between flex-shrink-0 gap-2 sm:gap-4">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden h-8 w-8 p-0"
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h2 className="text-base sm:text-lg font-semibold capitalize truncate block sm:hidden lg:block">{pageTitle}</h2>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end min-w-0">
              <div className="hidden sm:block flex-1 max-w-xs sm:max-w-sm">
                <GlobalSearch />
              </div>
              {/* Bell notification icon */}
              <Link href="/notifications">
                <button
                  type="button"
                  className="relative flex items-center justify-center h-8 w-8 rounded-lg hover:bg-accent transition-colors"
                  title="Notifications"
                  onClick={() => {
                    const now = String(Date.now());
                    localStorage.setItem("geem_notif_last_read", now);
                    window.dispatchEvent(new StorageEvent("storage", { key: "geem_notif_last_read", newValue: now }));
                    qc.invalidateQueries({ queryKey: ["notif-bell-count"] });
                  }}
                >
                  <Bell className="h-[18px] w-[18px]" />
                  {bellCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                      {bellCount > 99 ? "99+" : bellCount}
                    </span>
                  )}
                </button>
              </Link>

              {canInstall && (
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:flex h-8 gap-1.5 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                  onClick={install}
                  title="Install Geem CRM as an app"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Install App</span>
                </Button>
              )}
              <span
                className={`hidden sm:flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border flex-shrink-0 ${
                  isOnline
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
                title={isOnline ? "Connected to internet" : "No internet — showing cached data"}
              >
                <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${isOnline ? "bg-green-500" : "bg-amber-500 animate-pulse"}`} />
                <span className="hidden lg:inline">{isOnline ? "Online" : "Offline"}</span>
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title={user?.name ?? "Account"}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">
                        {user?.name
                          ? user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
                          : "??"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:flex flex-col items-start min-w-0">
                      <span className="text-sm font-medium leading-tight truncate max-w-32">{user?.name ?? "User"}</span>
                      <span className="text-xs text-muted-foreground leading-tight truncate max-w-32">{user?.role ?? ""}</span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden md:block flex-shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="pb-0">
                    <p className="font-medium truncate">{user?.name ?? "User"}</p>
                    <p className="text-xs text-muted-foreground font-normal truncate mt-0.5">{user?.email ?? ""}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="/settings" className="cursor-pointer">
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto">
            {children}
          </div>
        </main>
      </div>

      <AppSetupPrompt appName="Geem ERP" appIcon="/icon-192.png" />
    </div>
  );
}
