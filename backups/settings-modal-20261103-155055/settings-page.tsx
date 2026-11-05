"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/staff/types";

type Profile = {
  name: string;
  email: string;
  status: string;
  roles: string[];
  permissions: string[];
};

export default function SettingsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result.user) {
          throw new Error(
            getErrorMessage(result, "Unable to load your profile."),
          );
        }

        if (!cancelled) {
          setProfile(result.user as Profile);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Unable to load profile.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 12) {
      setError("The new password must contain at least 12 characters.");
      return;
    }

    if (password !== confirmation) {
      setError("New passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/dashboard/manage/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          password,
          password_confirmation: confirmation,
        }),
      });

      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(result, "Unable to change password."),
        );
      }

      setCurrentPassword("");
      setPassword("");
      setConfirmation("");

      // Laravel revokes all tokens after the password change.
      router.replace("/login?password_changed=1");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to change password.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.18em] text-[#6875f5]">
        MY ACCOUNT
      </p>

      <h2 className="mt-2 text-2xl font-bold text-[#263956]">
        Account Settings
      </h2>

      <p className="mt-2 text-sm text-[#8293af]">
        Review your account and update your password.
      </p>

      <div className="mt-7 grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-[#e1e6f0] bg-white p-7">
          <h3 className="text-base font-bold text-[#263956]">
            My Profile
          </h3>

          {loading ? (
            <p className="mt-6 text-sm text-[#8293af]">
              Loading profile...
            </p>
          ) : profile ? (
            <dl className="mt-7 space-y-6">
              <div>
                <dt className="text-xs font-semibold text-[#91a0b9]">
                  Full Name
                </dt>
                <dd className="mt-2 text-sm font-semibold text-[#263956]">
                  {profile.name}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-[#91a0b9]">
                  Email
                </dt>
                <dd className="mt-2 text-sm text-[#263956]">
                  {profile.email}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-[#91a0b9]">
                  Role
                </dt>
                <dd className="mt-2 text-sm capitalize text-[#263956]">
                  {profile.roles.join(", ").replaceAll("_", " ") || "—"}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-[#91a0b9]">
                  Account Status
                </dt>
                <dd className="mt-2 text-sm capitalize text-[#263956]">
                  {profile.status}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold text-[#91a0b9]">
                  Granted Permissions
                </dt>
                <dd className="mt-2 text-sm text-[#263956]">
                  {profile.permissions.length} permissions
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-6 text-sm text-amber-700">
              Profile information is unavailable.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-[#e1e6f0] bg-white p-7">
          <h3 className="text-base font-bold text-[#263956]">
            Change Password
          </h3>

          <p className="mt-2 text-xs leading-6 text-[#8293af]">
            After changing your password, you will need to sign in again.
          </p>

          <form onSubmit={changePassword} className="mt-7 space-y-5">
            <div>
              <label htmlFor="current-password" className="mb-2 block text-sm font-semibold text-[#405575]">
                Current Password
              </label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="w-full rounded-xl border border-[#dfe5f0] px-4 py-3 text-sm outline-none focus:border-[#626df1]"
              />
            </div>

            <div>
              <label htmlFor="new-password" className="mb-2 block text-sm font-semibold text-[#405575]">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-[#dfe5f0] px-4 py-3 text-sm outline-none focus:border-[#626df1]"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-sm font-semibold text-[#405575]">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="w-full rounded-xl border border-[#dfe5f0] px-4 py-3 text-sm outline-none focus:border-[#626df1]"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#626df1] px-6 py-3 text-sm font-semibold text-white hover:bg-[#505cdb] disabled:opacity-50"
            >
              {saving ? "Updating Password..." : "Update Password"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
