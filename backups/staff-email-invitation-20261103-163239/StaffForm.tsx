"use client";

import { useState } from "react";
import type {
  StaffFormValues,
  StaffMember,
} from "@/lib/staff/types";
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

  const [values, setValues] = useState<StaffFormValues>({
    name: member?.name || "",
    email: member?.email || "",
    role: member?.roles[0] || "",
    password: "",
    password_confirmation: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(key: keyof StaffFormValues, value: string) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!values.name.trim() || !values.email.trim() || !values.role) {
      setError("Name, email and role are required.");
      return;
    }

    if (!editing && values.password.length < 12) {
      setError("Password must contain at least 12 characters.");
      return;
    }

    if (!editing && values.password !== values.password_confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = editing
        ? {
            name: values.name.trim(),
            email: values.email.trim(),
            role: values.role,
          }
        : {
            name: values.name.trim(),
            email: values.email.trim(),
            role: values.role,
            password: values.password,
            password_confirmation: values.password_confirmation,
          };

      const url = editing
        ? `/api/dashboard/manage/users/${member.id}`
        : "/api/dashboard/manage/users";

      const response = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(result, "Unable to save staff member."),
        );
      }

      onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save staff member.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#182641]/55 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-form-title"
        className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="staff-form-title"
              className="text-xl font-bold text-[#263956]"
            >
              {editing ? "Edit Staff Member" : "Add Staff Member"}
            </h2>
            <p className="mt-2 text-sm text-[#8293af]">
              {editing
                ? "Update the employee's account information."
                : "Create a new employee account."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#e1e5f0] px-3 py-2 text-sm text-[#667895]"
          >
            Close
          </button>
        </div>

        <form onSubmit={submit} className="mt-7 space-y-5">
          <div>
            <label htmlFor="staff-name" className="mb-2 block text-sm font-semibold">
              Full Name
            </label>
            <input
              id="staff-name"
              required
              maxLength={255}
              value={values.name}
              onChange={(event) => update("name", event.target.value)}
              className="w-full rounded-xl border border-[#dfe5f0] px-4 py-3 text-sm outline-none focus:border-[#626df1]"
            />
          </div>

          <div>
            <label htmlFor="staff-email" className="mb-2 block text-sm font-semibold">
              Email Address
            </label>
            <input
              id="staff-email"
              type="email"
              required
              maxLength={255}
              value={values.email}
              onChange={(event) => update("email", event.target.value)}
              className="w-full rounded-xl border border-[#dfe5f0] px-4 py-3 text-sm outline-none focus:border-[#626df1]"
            />
          </div>

          <div>
            <label htmlFor="staff-role" className="mb-2 block text-sm font-semibold">
              Role
            </label>
            <select
              id="staff-role"
              required
              value={values.role}
              onChange={(event) => update("role", event.target.value)}
              className="w-full rounded-xl border border-[#dfe5f0] bg-white px-4 py-3 text-sm outline-none focus:border-[#626df1]"
            >
              <option value="">Select a role</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            {roles.length === 0 && (
              <p className="mt-2 text-xs text-amber-700">
                No assignable roles were returned by Laravel.
              </p>
            )}
          </div>

          {!editing && (
            <>
              <div>
                <label htmlFor="staff-password" className="mb-2 block text-sm font-semibold">
                  Temporary Password
                </label>
                <input
                  id="staff-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                  value={values.password}
                  onChange={(event) => update("password", event.target.value)}
                  className="w-full rounded-xl border border-[#dfe5f0] px-4 py-3 text-sm outline-none focus:border-[#626df1]"
                />
                <p className="mt-1 text-xs text-[#8293af]">
                  At least 12 characters.
                </p>
              </div>

              <div>
                <label htmlFor="staff-confirm-password" className="mb-2 block text-sm font-semibold">
                  Confirm Password
                </label>
                <input
                  id="staff-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={values.password_confirmation}
                  onChange={(event) =>
                    update("password_confirmation", event.target.value)
                  }
                  className="w-full rounded-xl border border-[#dfe5f0] px-4 py-3 text-sm outline-none focus:border-[#626df1]"
                />
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-[#e9edf5] pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-[#e1e5f0] px-5 py-3 text-sm font-semibold text-[#667895]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || !values.role}
              className="rounded-xl bg-[#626df1] px-6 py-3 text-sm font-semibold text-white hover:bg-[#505cdb] disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editing
                  ? "Save Changes"
                  : "Create Staff"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
