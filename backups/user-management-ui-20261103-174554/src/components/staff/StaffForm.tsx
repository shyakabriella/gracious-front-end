"use client";

import { useState } from "react";
import type { StaffMember } from "@/lib/staff/types";
import { getErrorMessage } from "@/lib/staff/types";

type Props = {
  member: StaffMember | null;
  roles: string[];
  onClose: () => void;
  onSaved: () => void;
};

export default function StaffForm({
  member,
  roles,
  onClose,
  onSaved,
}: Props) {
  const editing = member !== null;
  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [role, setRole] = useState(member?.roles[0] ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload: Record<string, string> = {
        name: name.trim(),
        email: email.trim(),
      };

      if (!editing || role !== (member.roles[0] ?? "")) {
        payload.role = role;
      }

      const url = editing
        ? `/api/dashboard/manage/users/${member.id}`
        : "/api/dashboard/manage/invitations";

      const response = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(result, "Unable to save the staff account."),
        );
      }

      if (!editing && result && typeof result === "object") {
        const record = result as {
          email_sent?: boolean;
          message?: string;
        };

        if (record.email_sent === false) {
          setNotice(
            record.message ||
              "Account created, but email delivery failed. Resend the invitation from the staff table.",
          );
          onSaved();
          return;
        }
      }

      onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save staff.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#182641]/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-dialog-title"
        className="my-auto w-full max-w-[520px] rounded-2xl border border-[#e1e6f0] bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-[#e9edf5] px-7 py-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#626df1]">
              Staff Management
            </p>
            <h2 id="staff-dialog-title" className="mt-2 text-xl font-bold text-[#263956]">
              {editing ? "Edit Staff Member" : "Add Staff Member"}
            </h2>
            <p className="mt-2 text-sm text-[#8293af]">
              {editing
                ? "Update the employee's account information."
                : "Create the account and email a password setup link."}
            </p>
          </div>

          <button type="button" onClick={onClose} disabled={saving}
            aria-label="Close form"
            className="rounded-lg border border-[#dfe5f0] px-3 py-2 text-sm text-[#60728f]">
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5 p-7">
          <div>
            <label htmlFor="staff-name" className="mb-2 block text-sm font-semibold text-[#405575]">
              Full Name
            </label>
            <input id="staff-name" required maxLength={255} autoFocus
              value={name} onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-[#dfe5f0] px-4 py-3 text-sm focus:border-[#626df1] focus:outline-none"
              placeholder="Employee full name" />
          </div>

          <div>
            <label htmlFor="staff-email" className="mb-2 block text-sm font-semibold text-[#405575]">
              Email Address
            </label>
            <input id="staff-email" type="email" required maxLength={255}
              value={email} onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-[#dfe5f0] px-4 py-3 text-sm focus:border-[#626df1] focus:outline-none"
              placeholder="employee@example.com" />
          </div>

          <div>
            <label htmlFor="staff-role" className="mb-2 block text-sm font-semibold text-[#405575]">
              Staff Role
            </label>
            <select id="staff-role" value={role} required
              onChange={(event) => setRole(event.target.value)}
              className="w-full rounded-xl border border-[#dfe5f0] bg-white px-4 py-3 text-sm focus:border-[#626df1] focus:outline-none">
              <option value="">Select a role</option>
              {roles.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>

          {!editing && (
            <div className="rounded-xl border border-[#e0e4fb] bg-[#f5f6ff] p-4">
              <p className="text-sm font-semibold text-[#4c5ad4]">
                <span aria-hidden="true">✉ </span>Email invitation
              </p>
              <p className="mt-2 text-xs leading-6 text-[#687995]">
                The employee will receive a secure link to set their own password.
                The link expires after 60 minutes. No temporary password is needed.
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {notice && <p role="status" className="text-sm text-amber-700">{notice}</p>}

          <div className="flex justify-end gap-3 border-t border-[#e9edf5] pt-5">
            <button type="button" onClick={onClose} disabled={saving}
              className="rounded-xl border border-[#dfe5f0] px-5 py-3 text-sm font-semibold text-[#60728f]">
              Cancel
            </button>
            <button type="submit" disabled={saving || !role}
              className="rounded-xl bg-[#626df1] px-5 py-3 text-sm font-semibold text-white hover:bg-[#505bda] disabled:opacity-50">
              {saving ? "Saving..." : editing ? "Save Changes" : "Create & Send Invitation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
