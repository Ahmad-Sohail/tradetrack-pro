"use client";
import { useState } from "react";
import { KeyRound, Save } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Input, Switch, toast } from "@neuctra/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { useTheme } from "@/app/contexts/ThemeContext";
import { PageHeader } from "./ui-bits";
import ConnectionsPanel from "./ConnectionsPanel";

export default function SettingsView() {
  const { user, setUser, isAdmin } = useAuth();
  const { isDark, setTheme } = useTheme();
  const [p, setP] = useState({ name: user.name, phone: user.client?.phone || "", country: user.client?.country || "" });
  const [pe, setPe] = useState({}); const [pb, setPb] = useState(false);
  const [w, setW] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [we, setWe] = useState({}); const [wb, setWb] = useState(false);

  const saveProfile = async () => {
    const e = {}; if (p.name.trim().length < 2) e.name = "Enter your name."; setPe(e); if (Object.keys(e).length) return;
    setPb(true);
    try { const body = isAdmin ? { name: p.name } : p; const r = await api("/auth/profile", { method: "PATCH", body }); setUser(r.user); toast.success("Profile saved"); }
    catch (err) { if (err instanceof ApiError) setPe(err.fields || {}); toast.error(err.message); } finally { setPb(false); }
  };
  const savePassword = async () => {
    const e = {};
    if (!w.currentPassword) e.currentPassword = "Enter your current password.";
    if (w.newPassword.length < 8) e.newPassword = "Use at least 8 characters.";
    if (w.confirm !== w.newPassword) e.confirm = "Passwords do not match.";
    setWe(e); if (Object.keys(e).length) return;
    setWb(true);
    try { await api("/auth/password", { method: "PATCH", body: { currentPassword: w.currentPassword, newPassword: w.newPassword } }); toast.success("Password updated"); setW({ currentPassword: "", newPassword: "", confirm: "" }); }
    catch (err) { if (err instanceof ApiError) setWe(err.fields || {}); toast.error(err.message); } finally { setWb(false); }
  };

  return (
    <>
      <PageHeader title="Settings" description="Manage your profile, password and appearance." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Profile" description={`Signed in as ${user.email} (${user.role})`} /><CardBody>
          <div className="flex flex-col gap-4">
            <Input label="Full name" required placeholder="Your name" value={p.name} error={pe.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
            {!isAdmin && <><Input label="Phone" type="tel" placeholder="+1 555 0100" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} />
              <Input label="Country" placeholder="e.g. Canada" value={p.country} onChange={(e) => setP({ ...p, country: e.target.value })} /></>}
            <div><Button iconBefore={<Save className="size-4" />} loading={pb} loadingText="Saving" onClick={saveProfile}>Save profile</Button></div>
          </div>
        </CardBody></Card>
        <div className="flex min-w-0 flex-col gap-6">
          <Card><CardHeader title="Appearance" /><CardBody><Switch label="Dark mode" checked={isDark} onCheckedChange={(c) => setTheme(c ? "dark" : "light")} /></CardBody></Card>
          <Card><CardHeader title="Change password" /><CardBody>
            <div className="flex flex-col gap-4">
              <Input label="Current password" type="password" placeholder="Current password" value={w.currentPassword} error={we.currentPassword} onChange={(e) => setW({ ...w, currentPassword: e.target.value })} />
              <Input label="New password" type="password" placeholder="At least 8 characters" value={w.newPassword} error={we.newPassword} onChange={(e) => setW({ ...w, newPassword: e.target.value })} />
              <Input label="Confirm new password" type="password" placeholder="Repeat new password" value={w.confirm} error={we.confirm} onChange={(e) => setW({ ...w, confirm: e.target.value })} />
              <div><Button variant="outline" iconBefore={<KeyRound className="size-4" />} loading={wb} loadingText="Updating" onClick={savePassword}>Update password</Button></div>
            </div>
          </CardBody></Card>
        </div>
      </div>
      {!isAdmin && user.clientId && <div className="mt-6"><ConnectionsPanel clientId={user.clientId} /></div>}
    </>
  );
}
