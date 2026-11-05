"use client";

import { useCallback, useEffect, useState } from "react";
import ChangePasswordModal from "@/components/account/ChangePasswordModal";
import { getErrorMessage } from "@/lib/staff/types";

type Profile = {
  id: number;
  name: string;
  email: string;
  status: string;
  roles: string[];
  permissions: string[];
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.user) {
        throw new Error(
          getErrorMessage(result, "Unable to load account information.")
        );
      }

      setProfile(result.user as Profile);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load account information."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial profile loading starts from the asynchronous task.
    // This avoids synchronous state updates inside the effect.
    const controller = new AbortController();

    async function initializeProfile() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          signal: controller.signal,
        });

        const result = await response.json();

        if (!response.ok || !result.user) {
          throw new Error(
            getErrorMessage(result, "Unable to load account information.")
          );
        }

        if (!controller.signal.aborted) {
          setProfile(result.user as Profile);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load account information."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void initializeProfile();

    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6875f5]">
            Administration
          </p>

          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#263956]">
            Account Settings
          </h2>

          <p className="mt-2 text-sm text-[#8293af]">
            View your account details and manage your security settings.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadProfile()}
          disabled={loading}
          className="rounded-xl border border-[#dfe4f0] bg-white px-5 py-3 text-xs font-semibold text-[#626df1] hover:bg-[#f6f7ff] disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh Details"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-[#e1e6f0] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9edf5] px-6 py-5">
          <div>
            <h3 className="text-[15px] font-bold text-[#263956]">
              My Account
            </h3>

            <p className="mt-1 text-xs text-[#91a0b9]">
              Information from your Gracious Investment account.
            </p>
          </div>

          {profile && (
            <span className="rounded-full bg-[#edf9f3] px-3 py-1.5 text-xs font-semibold capitalize text-[#16845d]">
              {profile.status}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-left">
            <thead className="bg-[#f8f9ff]">
              <tr className="text-[11px] uppercase tracking-[0.1em] text-[#8a9bb7]">
                <th className="px-6 py-4 font-semibold">Setting</th>
                <th className="px-6 py-4 font-semibold">Current Value</th>
                <th className="px-6 py-4 text-right font-semibold">Access</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#edf0f6]">
              {loading && !profile ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-12 text-center text-sm text-[#8293af]"
                  >
                    Loading account information...
                  </td>
                </tr>
              ) : profile ? (
                <>
                  <tr>
                    <td className="px-6 py-5 text-sm font-semibold text-[#405575]">
                      Full Name
                    </td>
                    <td className="px-6 py-5 text-sm text-[#263956]">
                      {profile.name}
                    </td>
                    <td className="px-6 py-5 text-right text-xs text-[#9aa9c0]">
                      Read only
                    </td>
                  </tr>

                  <tr>
                    <td className="px-6 py-5 text-sm font-semibold text-[#405575]">
                      Email Address
                    </td>
                    <td className="px-6 py-5 text-sm text-[#263956]">
                      {profile.email}
                    </td>
                    <td className="px-6 py-5 text-right text-xs text-[#9aa9c0]">
                      Read only
                    </td>
                  </tr>

                  <tr>
                    <td className="px-6 py-5 text-sm font-semibold text-[#405575]">
                      Assigned Role
                    </td>
                    <td className="px-6 py-5 text-sm capitalize text-[#263956]">
                      {profile.roles.join(", ").replaceAll("_", " ") || "—"}
                    </td>
                    <td className="px-6 py-5 text-right text-xs text-[#9aa9c0]">
                      Read only
                    </td>
                  </tr>

                  <tr>
                    <td className="px-6 py-5 text-sm font-semibold text-[#405575]">
                      Account Status
                    </td>
                    <td className="px-6 py-5 text-sm">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                          profile.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {profile.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right text-xs text-[#9aa9c0]">
                      Read only
                    </td>
                  </tr>

                  <tr>
                    <td className="px-6 py-5 text-sm font-semibold text-[#405575]">
                      Granted Permissions
                    </td>
                    <td className="px-6 py-5 text-sm text-[#263956]">
                      {profile.permissions.length} permissions
                    </td>
                    <td className="px-6 py-5 text-right text-xs text-[#9aa9c0]">
                      Read only
                    </td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-12 text-center text-sm text-[#8293af]"
                  >
                    Account information is unavailable.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#e1e6f0] bg-white shadow-sm">
        <div className="border-b border-[#e9edf5] px-6 py-5">
          <h3 className="text-[15px] font-bold text-[#263956]">
            Security Settings
          </h3>

          <p className="mt-1 text-xs text-[#91a0b9]">
            Manage account credentials using secure forms.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-left">
            <thead className="bg-[#f8f9ff]">
              <tr className="text-[11px] uppercase tracking-[0.1em] text-[#8a9bb7]">
                <th className="px-6 py-4 font-semibold">Security Setting</th>
                <th className="px-6 py-4 font-semibold">Description</th>
                <th className="px-6 py-4 text-right font-semibold">Action</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td className="px-6 py-6 text-sm font-semibold text-[#405575]">
                  Account Password
                </td>

                <td className="px-6 py-6 text-sm text-[#8293af]">
                  Update your password securely.
                </td>

                <td className="px-6 py-6 text-right">
                  <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    disabled={!profile}
                    className="rounded-lg border border-[#dfe4fb] bg-[#f5f6ff] px-4 py-2.5 text-xs font-semibold text-[#626df1] hover:bg-[#e9ebff] disabled:opacity-50"
                  >
                    Change Password
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <ChangePasswordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
