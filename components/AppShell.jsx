"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Settings, TrendingUp } from "lucide-react";
import { Avatar, Badge, Drawer, DrawerBody, DrawerContent, DrawerHeader, Dropdown, IconButton, Spinner, ThemeToggleButton } from "@neuctra/ui";
import { useAuth } from "@/app/contexts/AuthContext";
import { useTheme } from "@/app/contexts/ThemeContext";
import { adminNav, clientNav, isAdminOnlyPath } from "@/lib/nav";
import { initials } from "@/lib/format";

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 px-2 py-1 text-foreground">
      <TrendingUp className="size-5 text-primary" aria-hidden="true" />
      <span className="text-base font-semibold">TradeTrack Pro</span>
    </Link>
  );
}

function NavList({ groups, pathname, counts, onNavigate }) {
  const active = (href) => pathname === href || (href !== "/" && pathname.startsWith(href + "/") && !groups.flatMap((g) => g.items).some((i) => i.href !== href && i.href.length > href.length && (pathname === i.href || pathname.startsWith(i.href + "/"))));
  return (
    <nav aria-label="Primary" className="flex flex-col gap-6">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.label}</p>
          <ul className="flex flex-col gap-1">
            {g.items.map((i) => {
              const on = active(i.href);
              const n = i.badge ? counts[i.badge] : 0;
              return (
                <li key={i.href}>
                  <Link href={i.href} onClick={onNavigate} aria-current={on ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? "bg-accent font-medium text-primary" : "text-secondary hover:bg-accent hover:text-foreground"}`}>
                    <i.icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1 truncate">{i.label}</span>
                    {n > 0 && <Badge text={n > 99 ? "99+" : String(n)} variant="solid" size="sm" rounded />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function AppShell({ children }) {
  const { user, loading, logout, isAdmin, notifUnread, chatUnread } = useAuth();
  const theme = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (user.role === "client" && isAdminOnlyPath(pathname)) router.replace("/portal");
    if (user.role === "admin" && pathname.startsWith("/portal")) router.replace("/dashboard");
  }, [loading, user, pathname, router]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Spinner size="lg" label="Loading your workspace" /></div>;
  }
  if ((user.role === "client" && isAdminOnlyPath(pathname)) || (isAdmin && pathname.startsWith("/portal"))) return null;

  const groups = isAdmin ? adminNav : clientNav;
  const counts = { chat: chatUnread, notif: notifUnread };
  const menu = [
    { label: "Settings", icon: <Settings className="size-4" />, onClick: () => router.push("/settings") },
    { separator: true },
    { label: "Sign out", icon: <LogOut className="size-4" />, onClick: () => { logout(); router.replace("/login"); } },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 overflow-y-auto border-r border-border bg-card p-4 lg:flex">
        <Brand />
        <NavList groups={groups} pathname={pathname} counts={counts} />
      </aside>

      <Drawer isOpen={open} onClose={() => setOpen(false)} position="left" ariaLabel="Navigation menu">
        <DrawerContent>
          <DrawerHeader title="Menu" onClose={() => setOpen(false)} />
          <DrawerBody><NavList groups={groups} pathname={pathname} counts={counts} onNavigate={() => setOpen(false)} /></DrawerBody>
        </DrawerContent>
      </Drawer>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="lg:hidden"><IconButton icon={<Menu className="size-5" />} variant="ghost" aria-label="Open menu" onClick={() => setOpen(true)} /></div>
          <div className="lg:hidden"><Brand /></div>
          <div className="flex-1" />
          <ThemeToggleButton context={theme} />
          <div className="relative">
            <IconButton icon={<Bell className="size-5" />} variant="ghost" aria-label={`Notifications${notifUnread ? `, ${notifUnread} unread` : ""}`} onClick={() => router.push("/notifications")} />
            {notifUnread > 0 && <span className="pointer-events-none absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-primary-foreground">{notifUnread > 99 ? "99+" : notifUnread}</span>}
          </div>
          <Dropdown items={menu} width={200} trigger={
            <button type="button" aria-label="Account menu" className="flex min-h-11 items-center gap-2 rounded-md px-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar fallback={initials(user.name)} size="sm" alt={user.name} />
              <span className="hidden text-left sm:block"><span className="block max-w-40 truncate text-sm text-foreground">{user.name}</span><span className="block text-xs capitalize text-muted-foreground">{user.role}</span></span>
            </button>
          } />
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
