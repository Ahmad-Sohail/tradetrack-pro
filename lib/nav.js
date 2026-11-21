import { LayoutDashboard, Users, CandlestickChart, PlusCircle, Upload, LineChart, AreaChart, FileDown, MessageSquare, Bell, Settings } from "lucide-react";

export const adminNav = [
  { label: "Overview", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/clients", label: "Clients", icon: Users },
    { href: "/trades", label: "Trade history", icon: CandlestickChart },
    { href: "/trades/new", label: "Add trade", icon: PlusCircle },
    { href: "/import", label: "Import trades", icon: Upload },
  ] },
  { label: "Insights", items: [
    { href: "/analytics", label: "Profit and loss", icon: LineChart },
    { href: "/charts", label: "Charts", icon: AreaChart },
    { href: "/reports", label: "Reports", icon: FileDown },
  ] },
  { label: "Communication", items: [
    { href: "/chat", label: "Client chat", icon: MessageSquare, badge: "chat" },
    { href: "/notifications", label: "Notifications", icon: Bell, badge: "notif" },
  ] },
  { label: "Account", items: [{ href: "/settings", label: "Settings", icon: Settings }] },
];

export const clientNav = [
  { label: "My account", items: [
    { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
    { href: "/trades", label: "My trades", icon: CandlestickChart },
    { href: "/analytics", label: "Profit and loss", icon: LineChart },
    { href: "/charts", label: "Charts", icon: AreaChart },
    { href: "/reports", label: "Reports", icon: FileDown },
  ] },
  { label: "Communication", items: [
    { href: "/chat", label: "Message manager", icon: MessageSquare, badge: "chat" },
    { href: "/notifications", label: "Notifications", icon: Bell, badge: "notif" },
  ] },
  { label: "Account", items: [{ href: "/settings", label: "Settings", icon: Settings }] },
];

export const adminOnly = ["/dashboard", "/clients", "/trades/new", "/import"];
export const isAdminOnlyPath = (p) => adminOnly.some((a) => p === a || p.startsWith(a + "/")) || /^\/trades\/[^/]+\/edit\/?$/.test(p);
