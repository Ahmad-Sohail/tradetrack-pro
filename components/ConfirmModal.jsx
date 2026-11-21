"use client";
import { useState } from "react";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@neuctra/ui";
import { toast } from "@neuctra/ui";

export default function ConfirmModal({ open, title, message, confirmLabel = "Delete", onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { await onConfirm(); onClose(); }
    catch (e) { toast.error(e.message || "Action failed."); }
    finally { setBusy(false); }
  };
  return (
    <Modal isOpen={open} onClose={busy ? () => {} : onClose} ariaLabel={title}>
      <ModalContent maxWidth="max-w-md">
        <ModalHeader title={title} onClose={onClose} />
        <ModalBody><p className="text-sm text-secondary">{message}</p></ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="destructive" loading={busy} loadingText="Working" onClick={run}>{confirmLabel}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
