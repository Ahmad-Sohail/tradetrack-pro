"use client";
import { useEffect, useState } from "react";
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, Textarea, toast } from "@neuctra/ui";
import { api, ApiError } from "@/lib/api";

const blank = { name: "", email: "", phone: "", country: "", initialBalance: "", status: "active", notes: "", password: "" };

export default function ClientFormModal({ open, client, onClose, onSaved }) {
  const editing = !!client;
  const [v, setV] = useState(blank);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setErrs({});
    setV(client ? { ...blank, name: client.name, email: client.email, phone: client.phone || "", country: client.country || "", initialBalance: String(client.initialBalance ?? ""), status: client.status, notes: client.notes || "" } : blank);
  }, [open, client]);
  const set = (k) => (val) => { setV((s) => ({ ...s, [k]: val })); setErrs((e) => ({ ...e, [k]: undefined })); };
  const inp = (k) => ({ value: v[k], error: errs[k], onChange: (e) => set(k)(e.target.value) });

  const submit = async () => {
    const e = {};
    if (v.name.trim().length < 2) e.name = "Enter the client name.";
    if (!/^\S+@\S+\.\S+$/.test(v.email)) e.email = "Enter a valid email address.";
    if (!editing && v.password.length < 8) e.password = "Use at least 8 characters.";
    if (editing && v.password && v.password.length < 8) e.password = "Use at least 8 characters.";
    if (v.initialBalance !== "" && Number(v.initialBalance) < 0) e.initialBalance = "Balance cannot be negative.";
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const body = { ...v, initialBalance: v.initialBalance === "" ? 0 : Number(v.initialBalance) };
    if (!body.password) delete body.password;
    try {
      const r = await api(editing ? `/clients/${client.id}` : "/clients", { method: editing ? "PATCH" : "POST", body });
      toast.success(editing ? "Client updated" : "Client created");
      onSaved?.(r.client); onClose();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrs(err.fields);
      toast.error(err.message);
    } finally { setBusy(false); }
  };

  return (
    <Modal isOpen={open} onClose={busy ? () => {} : onClose} ariaLabel={editing ? "Edit client" : "Add client"}>
      <ModalContent maxWidth="max-w-2xl">
        <ModalHeader title={editing ? "Edit client" : "Add client"} onClose={onClose} />
        <ModalBody className="max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Full name" required placeholder="e.g. Jordan Lee" {...inp("name")} />
            <Input label="Email" required type="email" placeholder="jordan@example.com" {...inp("email")} />
            <Input label="Phone" type="tel" placeholder="+1 555 0100" {...inp("phone")} />
            <Input label="Country" placeholder="e.g. Canada" {...inp("country")} />
            <Input label="Starting balance" type="number" prefix="$" placeholder="e.g. 10000" {...inp("initialBalance")} />
            <Select label="Status" value={v.status} onValueChange={set("status")} options={[{ label: "Active", value: "active" }, { label: "Inactive", value: "inactive" }]} />
            <div className="sm:col-span-2"><Input label={editing ? "Reset password" : "Portal password"} required={!editing} type="password" placeholder={editing ? "Leave blank to keep current" : "At least 8 characters"} helperText={editing ? undefined : "The client signs in to their portal with this email and password."} {...inp("password")} /></div>
            <div className="sm:col-span-2"><Textarea label="Internal notes" placeholder="Only visible to you" maxLength={2000} value={v.notes} onChange={(e) => set("notes")(e.target.value)} /></div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button loading={busy} loadingText="Saving" onClick={submit}>{editing ? "Save changes" : "Create client"}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
