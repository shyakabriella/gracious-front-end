"use client";

import { useEffect, useState } from "react";
import { apiError, readJson } from "@/lib/crm/customers";

type Account = {
  id: number;
  roles: string[];
  permissions: string[];
};

type Property = {
  id: number;
  reference: string;
  title: string;
  created_by?: number;
  verification_status: string;
  availability_status: string;
  is_published: boolean;
  agent_id?: number | null;
  agent?: {
    id?: number;
    name: string;
  } | null;
};

type Agent = {
  id: number;
  name: string;
  email?: string;
};

type VerificationRecord = {
  id: number;
  decision: string;
  reason?: string | null;
  created_at?: string | null;
  reviewer?: {
    name: string;
  } | null;
};

type Props = {
  propertyId: number;
  propertyTitle: string;
  account: Account;
  onChanged: () => void;
  onClose: () => void;
};

const API = "/api/dashboard/manage";

export default function PropertyWorkflowModal({
  propertyId,
  propertyTitle,
  account,
  onChanged,
  onClose,
}: Props) {
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");

  const [reason, setReason] = useState("");
  const [availability, setAvailability] = useState("");
  const [agentId, setAgentId] = useState("");

  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState("");

  const [history, setHistory] = useState<VerificationRecord[]>([]);
  const [historyError, setHistoryError] = useState("");

  const manager = account.roles.some(
    (role) => role === "admin" || role === "super_admin",
  );

  const canUpdate = account.permissions.includes("properties.update");
  const canVerify =
    manager && account.permissions.includes("properties.verify");

  const canPublish = account.permissions.includes("properties.publish");

  const canAssign = manager && canUpdate;

  const canListAgents = account.permissions.includes("users.view");

  const canManage =
    canUpdate &&
    (manager ||
      (property !== null && property.created_by === account.id));

  const base = `${API}/properties/${propertyId}`;

  useEffect(() => {
    const controller = new AbortController();

    async function loadProperty() {
      setLoading(true);
      setLoadError("");

      try {
        const response = await fetch(base, {
          cache: "no-store",
          signal: controller.signal,
        });

        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(
            apiError(result, "Unable to load property workflow."),
          );
        }

        const data = result as { property?: Property };

        if (!data.property || data.property.id !== propertyId) {
          throw new Error("Invalid property response.");
        }

        if (!controller.signal.aborted) {
          setProperty(data.property);
          setAvailability(data.property.availability_status);
          setAgentId(
            data.property.agent_id
              ? String(data.property.agent_id)
              : "",
          );
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setLoadError(
            cause instanceof Error
              ? cause.message
              : "Unable to load property.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadProperty();

    return () => controller.abort();
  }, [base, propertyId, reload]);

  useEffect(() => {
    if (!canVerify) return;

    const controller = new AbortController();

    async function loadHistory() {
      setHistoryError("");

      try {
        const response = await fetch(
          `${base}/verification-history`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(
            apiError(result, "Unable to load verification history."),
          );
        }

        const data = result as {
          history?: VerificationRecord[];
        };

        if (!controller.signal.aborted) {
          setHistory(
            Array.isArray(data.history) ? data.history : [],
          );
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setHistoryError(
            cause instanceof Error
              ? cause.message
              : "Unable to load verification history.",
          );
        }
      }
    }

    void loadHistory();

    return () => controller.abort();
  }, [base, canVerify, reload]);

  useEffect(() => {
    if (!canAssign || !canListAgents) return;

    const controller = new AbortController();

    async function loadAgents() {
      setAgentsLoading(true);
      setAgentsError("");

      try {
        const response = await fetch(
          `${API}/users?role=agent&status=active&per_page=100`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result = await readJson(response);

        if (!response.ok) {
          throw new Error(
            apiError(result, "Unable to load active agents."),
          );
        }

        const data = result as { data?: Agent[] };

        if (!Array.isArray(data.data)) {
          throw new Error("Invalid agent list.");
        }

        if (!controller.signal.aborted) {
          setAgents(data.data);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setAgentsError(
            cause instanceof Error
              ? cause.message
              : "Unable to load agents.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setAgentsLoading(false);
        }
      }
    }

    void loadAgents();

    return () => controller.abort();
  }, [canAssign, canListAgents]);

  async function execute(
    operation: string,
    method: "POST" | "PATCH",
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    if (busy || loading) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${base}/${operation}`, {
        method,
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await readJson(response);

      if (!response.ok) {
        throw new Error(
          apiError(result, "Property workflow operation failed."),
        );
      }

      setNotice(successMessage);
      setReload((value) => value + 1);
      onChanged();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to complete this operation.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitForReview() {
    if (
      !canManage ||
      !property ||
      !["draft", "rejected"].includes(property.verification_status)
    ) {
      return;
    }

    await execute(
      "submit",
      "POST",
      {},
      "Property submitted for verification.",
    );
  }

  async function review(status: "verified" | "rejected") {
    if (!canVerify || property?.verification_status !== "pending") {
      return;
    }

    if (status === "rejected" && !reason.trim()) {
      setError("Please provide a reason for rejecting this property.");
      return;
    }

    if (reason.length > 2000) {
      setError("The review reason must not exceed 2,000 characters.");
      return;
    }

    if (
      !window.confirm(
        status === "verified"
          ? "Approve verification of this property?"
          : "Reject verification of this property?",
      )
    ) {
      return;
    }

    await execute(
      "verification",
      "PATCH",
      {
        status,
        ...(status === "rejected"
          ? { reason: reason.trim() }
          : {}),
      },
      status === "verified"
        ? "Property verified successfully."
        : "Property verification rejected.",
    );

    setReason("");
  }

  async function changePublication() {
    if (!property || !canPublish) return;

    const next = !property.is_published;

    if (
      next &&
      (
        property.verification_status !== "verified" ||
        property.availability_status !== "available"
      )
    ) {
      setError("Only verified and available properties can be published.");
      return;
    }

    if (
      !window.confirm(
        next
          ? "Publish this property on the public website?"
          : "Unpublish this property?",
      )
    ) {
      return;
    }

    await execute(
      "publish",
      "PATCH",
      { is_published: next },
      next ? "Property published." : "Property unpublished.",
    );
  }

  async function changeAvailability() {
    if (!canManage || !property || !availability) return;
    if (availability === property.availability_status) return;

    const allowed = manager
      ? ["available", "reserved", "sold", "rented", "archived"]
      : ["available", "reserved"];

    if (!allowed.includes(availability)) return;

    if (
      !window.confirm(
        `Change property availability to "${availability}"?\n\n` +
        "Laravel will validate active rentals and publication rules.",
      )
    ) {
      return;
    }

    await execute(
      "availability",
      "PATCH",
      { status: availability },
      "Property availability updated.",
    );
  }

  async function assignAgent() {
    if (!canAssign || !canListAgents || !property) return;

    const selected = Number(agentId);

    if (
      !Number.isSafeInteger(selected) ||
      selected <= 0 ||
      !agents.some((agent) => agent.id === selected)
    ) {
      setError("Please select an active real estate agent.");
      return;
    }

    if (
      !window.confirm("Assign this agent to the property?")
    ) {
      return;
    }

    await execute(
      "assign-agent",
      "PATCH",
      { agent_id: selected },
      "Property agent assigned successfully.",
    );
  }

  const canSubmit =
    canManage &&
    property !== null &&
    ["draft", "rejected"].includes(property.verification_status);

  const canReview =
    canVerify && property?.verification_status === "pending";

  const canGoPublic =
    property?.verification_status === "verified" &&
    property?.availability_status === "available";

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800";

  const buttonClass =
    "rounded-lg bg-[#263956] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-workflow-title"
        className="mx-auto my-5 max-w-3xl space-y-5 rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="property-workflow-title"
              className="text-xl font-bold text-[#263956]"
            >
              Property Workflow
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {propertyTitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close property workflow"
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
          >
            ✕
          </button>
        </header>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {notice && (
          <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            {notice}
          </p>
        )}

        {loadError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {loadError}
          </p>
        )}

        {loading && (
          <p className="py-5 text-sm text-slate-500">
            Loading property workflow...
          </p>
        )}

        {!loading && property && (
          <>
            <section className="rounded-xl border p-4">
              <h3 className="font-bold text-[#263956]">
                Current Property Status
              </h3>

              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <p>
                  <strong>Reference:</strong> {property.reference}
                </p>
                <p>
                  <strong>Verification:</strong>{" "}
                  {property.verification_status}
                </p>
                <p>
                  <strong>Availability:</strong>{" "}
                  {property.availability_status}
                </p>
                <p>
                  <strong>Published:</strong>{" "}
                  {property.is_published ? "Yes" : "No"}
                </p>
                <p className="sm:col-span-2">
                  <strong>Assigned agent:</strong>{" "}
                  {property.agent?.name || "Not assigned"}
                </p>
              </div>
            </section>

            {canSubmit && (
              <section className="rounded-xl border p-4">
                <h3 className="font-bold text-[#263956]">
                  Submit for Verification
                </h3>

                <p className="mt-2 text-sm text-slate-600">
                  Send this property to management for review.
                </p>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitForReview()}
                  className={`${buttonClass} mt-3`}
                >
                  {busy ? "Processing..." : "Submit for Review"}
                </button>
              </section>
            )}

            {canReview && (
              <section className="space-y-3 rounded-xl border p-4">
                <h3 className="font-bold text-[#263956]">
                  Verification Decision
                </h3>

                <p className="text-sm text-slate-600">
                  Approve the property or provide a reason for rejection.
                </p>

                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="Reason for rejection"
                  className={inputClass}
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void review("verified")}
                    className={buttonClass}
                  >
                    Approve Property
                  </button>

                  <button
                    type="button"
                    disabled={busy || !reason.trim()}
                    onClick={() => void review("rejected")}
                    className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Reject Property
                  </button>
                </div>
              </section>
            )}

            {canPublish && (
              <section className="rounded-xl border p-4">
                <h3 className="font-bold text-[#263956]">
                  Publication
                </h3>

                <p className="mt-2 text-sm text-slate-600">
                  Properties must be verified and available before
                  they can be published.
                </p>

                <button
                  type="button"
                  disabled={
                    busy ||
                    (!property.is_published && !canGoPublic)
                  }
                  onClick={() => void changePublication()}
                  className={`${buttonClass} mt-3`}
                >
                  {property.is_published
                    ? "Unpublish Property"
                    : "Publish Property"}
                </button>
              </section>
            )}

            {canManage && (
              <section className="space-y-3 rounded-xl border p-4">
                <h3 className="font-bold text-[#263956]">
                  Property Availability
                </h3>

                <p className="text-sm text-slate-600">
                  Changing availability may automatically unpublish
                  the property. Active rentals are checked by Laravel.
                </p>

                <select
                  value={availability}
                  onChange={(event) => setAvailability(event.target.value)}
                  disabled={busy}
                  className={inputClass}
                  aria-label="Property availability"
                >
                  <option value="available">Available</option>
                  <option value="reserved">Reserved</option>

                  {manager && (
                    <>
                      <option value="sold">Sold</option>
                      <option value="rented">Rented</option>
                      <option value="archived">Archived</option>
                    </>
                  )}
                </select>

                <button
                  type="button"
                  disabled={
                    busy ||
                    !availability ||
                    availability === property.availability_status
                  }
                  onClick={() => void changeAvailability()}
                  className={buttonClass}
                >
                  Save Availability
                </button>

                {manager && (
                  <p className="text-xs text-slate-500">
                    Rented status requires an active rental agreement.
                    Laravel will reject invalid status changes.
                  </p>
                )}
              </section>
            )}

            {canAssign && (
              <section className="space-y-3 rounded-xl border p-4">
                <h3 className="font-bold text-[#263956]">
                  Assign Real Estate Agent
                </h3>

                {!canListAgents ? (
                  <p className="text-sm text-amber-700">
                    Your account requires users.view permission
                    to retrieve the active agent directory.
                  </p>
                ) : (
                  <>
                    {agentsError && (
                      <p role="alert" className="text-sm text-red-700">
                        {agentsError}
                      </p>
                    )}

                    <select
                      value={agentId}
                      onChange={(event) => setAgentId(event.target.value)}
                      disabled={busy || agentsLoading}
                      aria-label="Assigned real estate agent"
                      className={inputClass}
                    >
                      <option value="">Select active agent</option>

                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                          {agent.email ? ` (${agent.email})` : ""}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={
                        busy ||
                        agentsLoading ||
                        !agentId ||
                        !agents.some(
                          (agent) => agent.id === Number(agentId),
                        ) ||
                        Number(agentId) === property.agent_id
                      }
                      onClick={() => void assignAgent()}
                      className={buttonClass}
                    >
                      Assign Agent
                    </button>
                  </>
                )}
              </section>
            )}

            {canVerify && (
              <section className="rounded-xl border p-4">
                <h3 className="font-bold text-[#263956]">
                  Verification History
                </h3>

                {historyError && (
                  <p role="alert" className="mt-2 text-sm text-red-700">
                    {historyError}
                  </p>
                )}

                {!historyError && history.length === 0 && (
                  <p className="mt-2 text-sm text-slate-500">
                    No verification decisions recorded yet.
                  </p>
                )}

                <div className="mt-3 space-y-3">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg bg-slate-50 p-3 text-sm"
                    >
                      <p className="font-semibold text-[#263956]">
                        {item.decision.replaceAll("_", " ")}
                      </p>

                      <p className="text-slate-600">
                        Reviewed by: {item.reviewer?.name || "Unknown"}
                      </p>

                      {item.reason && (
                        <p className="mt-1 whitespace-pre-wrap text-slate-600">
                          Reason: {item.reason}
                        </p>
                      )}

                      {item.created_at && (
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(item.created_at).toLocaleString("en-RW")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!canManage && !canVerify && !canPublish && (
              <p className="text-sm text-slate-500">
                You can view this property, but you do not have
                permission to perform workflow operations.
              </p>
            )}
          </>
        )}

        <footer className="flex justify-end border-t pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-[#263956] disabled:opacity-40"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
