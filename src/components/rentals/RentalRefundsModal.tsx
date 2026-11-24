"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

type Account = {
  id: number;
  roles: string[];
  permissions: string[];
};

type Payment = {
  id: number;
  reference: string;
  amount: string;
  currency: string;
  payment_date: string;
  status: string;
};

type RefundDestination = {
  id: number;
  property_rent_refund_id: number;
  status: string;
  recorded_by: number;
  approved_by: number | null;
  refund_method: string;
};

type Refund = {
  id: number;
  reference: string;
  destination?: RefundDestination | null;
  property_rent_payment_id: number;
  requested_by: number;
  approved_by: number | null;
  processed_by: number | null;
  transaction_reference?: string | null;
  amount: string;
  currency: string;
  status: string;
  reason: string;
  rejection_reason?: string | null;
  created_at?: string;
  requester?: { name: string } | null;
  approver?: { name: string } | null;
};

type RefundEvidence = {
  id: number;
  original_name: string;
  mime_type?: string;
  file_size?: number;
  uploaded_by: number;
  verified_at?: string | null;
  uploader?: { name: string } | null;
  verifier?: { name: string } | null;
};

type Balance = {
  available_refund: string;
  reserved_refunds?: string;
  overpayment?: string;
};

type Props = {
  rentalId: number;
  rentalReference: string;
  rentalStatus: string;
  currency: string;
  account: Account;
  onClose: () => void;
  onChanged?: () => void;
};

const API = "/api/dashboard/manage";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white " +
  "px-3 py-2 text-sm text-slate-900 " +
  "focus:border-blue-600 focus:outline-none";

const buttonClass =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 " +
  "text-sm font-semibold text-slate-700 hover:bg-slate-50 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const primaryClass =
  "rounded-lg bg-[#263956] px-4 py-2 text-sm font-semibold " +
  "text-white hover:bg-[#344d72] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

function money(
  value: string | number | null | undefined,
  currency: string,
) {
  if (value === null || value === undefined) return "—";

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return `${currency} ${value}`;
  }

  return `${currency} ${number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function readable(value: string) {
  return value.replaceAll("_", " ");
}

async function readResponse<T>(response: Response): Promise<T> {
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (data && typeof data === "object") {
      const result = data as {
        message?: string;
        errors?: Record<string, string[]>;
      };

      const firstError = result.errors
        ? Object.values(result.errors).flat()[0]
        : undefined;

      throw new Error(
        firstError ||
        result.message ||
        `Request failed (${response.status}).`,
      );
    }

    throw new Error(`Request failed (${response.status}).`);
  }

  return data as T;
}

export default function RentalRefundsModal({
  rentalId,
  rentalReference,
  rentalStatus,
  currency,
  account,
  onClose,
  onChanged,
}: Props) {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);

  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [destinationRefundId, setDestinationRefundId] =
    useState<number | null>(null);
  const [destinationMethod, setDestinationMethod] =
    useState("bank_transfer");
  const [recipientName, setRecipientName] = useState("");
  const [recipientIdentifier, setRecipientIdentifier] = useState("");
  const [providerName, setProviderName] = useState("");

  const [processingRefundId, setProcessingRefundId] =
    useState<number | null>(null);
  const [processingReference, setProcessingReference] =
    useState("");

  const [selectedEvidenceRefundId, setSelectedEvidenceRefundId] =
    useState<number | null>(null);

  const [refundEvidences, setRefundEvidences] =
    useState<RefundEvidence[]>([]);

  const [evidenceLoadedRefundId, setEvidenceLoadedRefundId] =
    useState<number | null>(null);

  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState("");

  const [evidenceFile, setEvidenceFile] =
    useState<File | null>(null);

  const [evidenceReloadKey, setEvidenceReloadKey] =
    useState(0);

  const [evidenceInputKey, setEvidenceInputKey] =
    useState(0);

  const [reconciliation, setReconciliation] = useState({
    evidenceId: "",
    confirmationSource: "",
    reference: "",
    amount: "",
    currency: "",
    recipient: "",
    confirmedAt: "",
    outcome: "",
    notes: "",
    externalRecordChecked: false,
  });

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const roles = account.roles || [];
  const permissions = account.permissions || [];

  const canRequest =
    permissions.includes("rentals.update") &&
    roles.some((role) =>
      ["super_admin", "admin", "property_manager"].includes(role),
    );

  const canRecordDestination =
    permissions.includes("rentals.update") &&
    roles.some((role) =>
      ["super_admin", "admin", "property_manager"].includes(role),
    );

  const canReview =
    permissions.includes("rentals.update") &&
    roles.some((role) =>
      ["super_admin", "admin"].includes(role),
    );

  const canViewEvidence =
    permissions.includes("rentals.view") &&
    roles.some((role) =>
      [
        "super_admin",
        "admin",
        "property_manager",
        "accountant",
      ].includes(role),
    );

  const canUploadEvidence =
    permissions.includes("rentals.view") &&
    permissions.includes("rentals.update") &&
    roles.some((role) =>
      ["super_admin", "admin", "property_manager"].includes(role),
    );

  const canProcess =
    permissions.includes("rentals.refunds.process") &&
    roles.some((role) =>
      ["super_admin", "admin", "accountant"].includes(role),
    );

  const rentalEnded =
    ["terminated", "expired"].includes(rentalStatus);

  const base = `${API}/rentals/${rentalId}`;

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const [refundResponse, paymentResponse] = await Promise.all([
        fetch(`${base}/refunds`, {
          cache: "no-store",
          signal,
        }),
        fetch(`${base}/payments`, {
          cache: "no-store",
          signal,
        }),
      ]);

      const refundData = await readResponse<{
        refunds: Refund[];
        balance: Balance;
      }>(refundResponse);

      const paymentData = await readResponse<{
        payments: Payment[];
      }>(paymentResponse);

      if (!signal?.aborted) {
        setRefunds(
          Array.isArray(refundData.refunds) ? refundData.refunds : [],
        );

        setBalance(refundData.balance || null);

        setPayments(
          Array.isArray(paymentData.payments)
            ? paymentData.payments
            : [],
        );
      }
    },
    [base],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        await refresh(controller.signal);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load rental refund records.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [refresh]);


  useEffect(() => {
    const controller = new AbortController();

    if (
      selectedEvidenceRefundId === null ||
      !canViewEvidence
    ) {
      return () => controller.abort();
    }

    async function loadEvidence() {
      setEvidenceLoading(true);
      setEvidenceError("");
      setRefundEvidences([]);
      setEvidenceLoadedRefundId(null);

      try {
        const response = await fetch(
          `${base}/refunds/${selectedEvidenceRefundId}/evidences`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result = await readResponse<{
          evidences: RefundEvidence[];
        }>(response);

        if (!controller.signal.aborted) {
          setRefundEvidences(
            Array.isArray(result.evidences)
              ? result.evidences
              : [],
          );
          setEvidenceLoadedRefundId(selectedEvidenceRefundId);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setEvidenceError(
            cause instanceof Error
              ? cause.message
              : "Unable to load refund evidence.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setEvidenceLoading(false);
        }
      }
    }

    void loadEvidence();

    return () => controller.abort();
  }, [
    base,
    selectedEvidenceRefundId,
    canViewEvidence,
    evidenceReloadKey,
  ]);


  async function uploadRefundEvidence(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const refund = refunds.find(
      (item) => item.id === selectedEvidenceRefundId,
    );

    if (
      busy ||
      !canUploadEvidence ||
      !refund ||
      !["approved", "processing"].includes(refund.status)
    ) {
      setEvidenceError(
        "Evidence uploads require an approved or processing " +
        "refund and an authorized staff account.",
      );
      return;
    }

    if (!evidenceFile || evidenceFile.size === 0) {
      setEvidenceError("Select a non-empty evidence file.");
      return;
    }

    if (evidenceFile.size > 5 * 1024 * 1024) {
      setEvidenceError("Maximum evidence file size is 5 MB.");
      return;
    }

    const extension = evidenceFile.name
      .split(".")
      .pop()
      ?.toLowerCase();

    if (
      !extension ||
      !["pdf", "jpg", "jpeg", "png"].includes(extension)
    ) {
      setEvidenceError(
        "Only PDF, JPG, JPEG and PNG files are supported.",
      );
      return;
    }

    setBusy(true);
    setEvidenceError("");
    setError("");
    setMessage("");

    try {
      const form = new FormData();
      form.append("file", evidenceFile, evidenceFile.name);

      const response = await fetch(
        `/api/dashboard/rental-refund-evidence/` +
        `${rentalId}/${refund.id}`,
        {
          method: "POST",
          body: form,
          cache: "no-store",
        },
      );

      await readResponse(response);

      setEvidenceFile(null);
      setEvidenceInputKey((value) => value + 1);
      setEvidenceReloadKey((value) => value + 1);

      setMessage(
        "Refund evidence uploaded successfully. " +
        "Independent external payment verification is still required.",
      );
    } catch (cause) {
      setEvidenceError(
        cause instanceof Error
          ? cause.message
          : "Unable to upload refund evidence.",
      );
    } finally {
      setBusy(false);
    }
  }


  function resetReconciliation() {
    setReconciliation({
      evidenceId: "",
      confirmationSource: "",
      reference: "",
      amount: "",
      currency: "",
      recipient: "",
      confirmedAt: "",
      outcome: "",
      notes: "",
      externalRecordChecked: false,
    });
  }


  function chooseEvidenceRefund(refundId: number | null) {
    const nextId =
      refundId === null || selectedEvidenceRefundId === refundId
        ? null
        : refundId;

    resetReconciliation();
    setEvidenceFile(null);
    setEvidenceInputKey((value) => value + 1);
    setRefundEvidences([]);
    setEvidenceLoadedRefundId(null);
    setEvidenceError("");
    setEvidenceLoading(nextId !== null);
    setSelectedEvidenceRefundId(nextId);
  }

  function canReconcileRefund(refund: Refund): boolean {
    const destination = refund.destination;

    if (
      !canReview ||
      !Number.isSafeInteger(account.id) ||
      account.id <= 0 ||
      refund.status !== "processing" ||
      destination?.status !== "approved"
    ) {
      return false;
    }

    const participants = [
      refund.requested_by,
      refund.approved_by,
      refund.processed_by,
      destination.recorded_by,
      destination.approved_by,
    ];

    return participants.every(
      (id) =>
        typeof id === "number" &&
        Number.isSafeInteger(id) &&
        id > 0 &&
        id !== account.id,
    );
  }

  async function reconcileRefund(
    event: FormEvent<HTMLFormElement>,
    refund: Refund,
  ) {
    event.preventDefault();

    if (
      busy ||
      evidenceLoading ||
      evidenceLoadedRefundId !== refund.id ||
      selectedEvidenceRefundId !== refund.id ||
      !canReconcileRefund(refund)
    ) {
      setEvidenceError(
        "An independent authorized reviewer is required.",
      );
      return;
    }

    const evidence = refundEvidences.find(
      (item) => item.id === Number(reconciliation.evidenceId),
    );

    if (
      !evidence ||
      !Number.isSafeInteger(evidence.uploaded_by) ||
      evidence.uploaded_by <= 0 ||
      evidence.uploaded_by === account.id
    ) {
      setEvidenceError(
        "Choose evidence uploaded by another authorized person.",
      );
      return;
    }

    const reference = reconciliation.reference.trim();
    const recipient = reconciliation.recipient.trim();
    const amount = reconciliation.amount.trim();
    const currency = reconciliation.currency.trim();
    const notes = reconciliation.notes.trim();
    const confirmedAt = new Date(reconciliation.confirmedAt);

    if (
      !["bank_statement", "provider_portal"].includes(
        reconciliation.confirmationSource,
      ) ||
      !["success", "failed"].includes(reconciliation.outcome) ||
      reference.length < 5 ||
      reference.length > 255 ||
      !/^\d+(\.\d{1,2})?$/.test(amount) ||
      Number(amount) <= 0 ||
      currency.length === 0 ||
      currency.length > 10 ||
      recipient.length === 0 ||
      recipient.length > 255 ||
      notes.length < 20 ||
      notes.length > 3000 ||
      !Number.isFinite(confirmedAt.getTime()) ||
      confirmedAt.getTime() > Date.now() ||
      !reconciliation.externalRecordChecked
    ) {
      setEvidenceError(
        "Complete all external verification fields correctly.",
      );
      return;
    }

    if (
      !window.confirm(
        "Confirm that you independently checked the actual " +
        "bank or provider record. This action will finalize " +
        "the refund as PAID or FAILED. Continue?",
      )
    ) {
      return;
    }

    setBusy(true);
    setEvidenceError("");
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${base}/refunds/${refund.id}/reconcile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            evidence_id: evidence.id,
            confirmation_source:
              reconciliation.confirmationSource,
            provider_transaction_reference: reference,
            confirmed_amount: amount,
            currency,
            confirmed_recipient: recipient,
            provider_confirmed_at: confirmedAt.toISOString(),
            outcome: reconciliation.outcome,
            verification_notes: notes,
            external_record_checked: true,
          }),
        },
      );

      await readResponse(response);

      resetReconciliation();
      setSelectedEvidenceRefundId(null);
      setRefundEvidences([]);

      setMessage(
        "Independent reconciliation recorded by Laravel. " +
        "The refund status has been updated.",
      );

      await refresh();
      onChanged?.();
    } catch (cause) {
      setEvidenceError(
        cause instanceof Error
          ? cause.message
          : "Unable to reconcile this refund.",
      );
    } finally {
      setBusy(false);
    }
  }

  const verifiedPayments = payments.filter(
    (payment) =>
      payment.status === "verified" &&
      payment.currency === currency,
  );

  const available = Number(balance?.available_refund ?? "0");

  async function requestRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy || !canRequest || !rentalEnded) return;

    const parsedPaymentId = Number(paymentId);

    if (
      !Number.isSafeInteger(parsedPaymentId) ||
      !verifiedPayments.some(
        (payment) => payment.id === parsedPaymentId,
      )
    ) {
      setError("Select a verified rental payment.");
      return;
    }

    if (
      !/^\d+(?:\.\d{1,2})?$/.test(amount) ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0
    ) {
      setError("Enter a positive refund amount with up to 2 decimals.");
      return;
    }

    if (reason.trim().length < 5) {
      setError("Provide a refund reason of at least 5 characters.");
      return;
    }

    if (
      !balance ||
      !Number.isFinite(available) ||
      available <= 0
    ) {
      setError("There is no available refundable balance.");
      return;
    }

    // Laravel makes the authoritative monetary comparison.
    // Do not use JavaScript floating-point arithmetic to
    // authorize or reserve a refund amount.
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${base}/refunds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          property_rent_payment_id: parsedPaymentId,
          amount,
          reason: reason.trim(),
        }),
      });

      await readResponse<{ refund: Refund }>(response);

      setPaymentId("");
      setAmount("");
      setReason("");

      setMessage(
        "Refund request submitted. Independent approval is required.",
      );

      await refresh();
      onChanged?.();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to submit refund request.",
      );
    } finally {
      setBusy(false);
    }
  }


  async function reviewRefund(
    refund: Refund,
    action: "approve" | "reject",
  ) {
    if (
      busy ||
      !canReview ||
      refund.status !== "pending" ||
      !Number.isSafeInteger(refund.requested_by) ||
      refund.requested_by <= 0 ||
      refund.requested_by === account.id
    ) {
      setError(
        "This action requires an independent authorized reviewer."
      );
      return;
    }

    const reasonText = rejectionReason.trim();

    if (
      action === "reject" &&
      (reasonText.length < 5 || reasonText.length > 2000)
    ) {
      setError(
        "Rejection reason must contain 5 to 2000 characters."
      );
      return;
    }

    if (
      action === "approve" &&
      !window.confirm(
        `Approve refund ${refund.reference} for ` +
        `${money(refund.amount, refund.currency)}? ` +
        "Approval does not transfer money."
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${base}/refunds/${refund.id}/${action}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify(
            action === "reject"
              ? { reason: reasonText }
              : {}
          ),
        }
      );

      await readResponse(response);

      setRejectingId(null);
      setRejectionReason("");

      setMessage(
        action === "approve"
          ? "Refund approved. Payout is not yet confirmed."
          : "Refund request rejected."
      );

      await refresh();
      onChanged?.();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : `Unable to ${action} refund.`
      );
    } finally {
      setBusy(false);
    }
  }


  function clearDestinationForm() {
    setDestinationRefundId(null);
    setDestinationMethod("bank_transfer");
    setRecipientName("");
    setRecipientIdentifier("");
    setProviderName("");
  }

  async function saveDestination(
    event: FormEvent<HTMLFormElement>,
    refund: Refund,
  ) {
    event.preventDefault();

    if (
      busy ||
      !canRecordDestination ||
      refund.status !== "approved" ||
      refund.destination ||
      destinationRefundId !== refund.id
    ) {
      return;
    }

    const name = recipientName.trim();
    const identifier = recipientIdentifier.trim();
    const provider = providerName.trim();

    if (
      name.length < 2 || name.length > 255 ||
      identifier.length < 5 || identifier.length > 255 ||
      provider.length < 2 || provider.length > 150
    ) {
      setError("Check the recipient name, account number and provider.");
      return;
    }

    if (
      !["bank_transfer", "mobile_money"].includes(destinationMethod)
    ) {
      setError("Choose a valid refund transfer method.");
      return;
    }

    if (
      !window.confirm(
        "Record this refund destination? " +
        "The destination cannot be replaced after submission. " +
        "Verify the recipient details before continuing."
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${base}/refunds/${refund.id}/destination`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            refund_method: destinationMethod,
            recipient_name: name,
            recipient_identifier: identifier,
            provider_name: provider,
          }),
        },
      );

      await readResponse(response);

      clearDestinationForm();
      setMessage(
        "Destination recorded. Independent approval is required."
      );

      await refresh();
      onChanged?.();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to record the refund destination."
      );
    } finally {
      setBusy(false);
    }
  }

  async function approveDestination(refund: Refund) {
    const destination = refund.destination;

    if (
      busy ||
      !canReview ||
      refund.status !== "approved" ||
      !destination ||
      destination.status !== "pending" ||
      !Number.isSafeInteger(destination.recorded_by) ||
      destination.recorded_by <= 0 ||
      !Number.isSafeInteger(refund.requested_by) ||
      refund.requested_by <= 0 ||
      destination.recorded_by === account.id ||
      refund.requested_by === account.id
    ) {
      setError("Destination approval requires an independent administrator.");
      return;
    }

    if (
      !window.confirm(
        "Approve this refund destination? Confirm that the " +
        "recipient information was checked independently. " +
        "This action does not transfer money."
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${base}/refunds/${refund.id}/destination/approve`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({}),
        },
      );

      await readResponse(response);

      setMessage(
        "Destination approved. Independent processing and " +
        "payout reconciliation are still required."
      );

      await refresh();
      onChanged?.();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to approve refund destination."
      );
    } finally {
      setBusy(false);
    }
  }


  function clearProcessingForm() {
    setProcessingRefundId(null);
    setProcessingReference("");
  }

  async function startRefundProcessing(
    event: FormEvent<HTMLFormElement>,
    refund: Refund,
  ) {
    event.preventDefault();

    const destination = refund.destination;

    if (
      busy ||
      !canProcess ||
      !rentalEnded ||
      refund.status !== "approved" ||
      destination?.status !== "approved" ||
      processingRefundId !== refund.id ||
      !Number.isSafeInteger(refund.requested_by) ||
      refund.requested_by <= 0 ||
      !Number.isSafeInteger(refund.approved_by) ||
      (refund.approved_by ?? 0) <= 0 ||
      refund.requested_by === account.id ||
      refund.approved_by === account.id
    ) {
      setError(
        "Processing requires an approved destination " +
        "and an independent authorized officer."
      );
      return;
    }

    const method = destination.refund_method;
    const reference = processingReference.trim();

    if (!["bank_transfer", "mobile_money"].includes(method)) {
      setError("Approved destination method is unavailable.");
      return;
    }

    if (reference.length < 5 || reference.length > 255) {
      setError(
        "Transaction reference must contain 5 to 255 characters."
      );
      return;
    }

    if (
      !window.confirm(
        `Start processing refund ${refund.reference} using ` +
        `${method.replaceAll("_", " ")}? ` +
        "Confirm that the external transfer was submitted. " +
        "This action will NOT mark the refund as paid."
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${base}/refunds/${refund.id}/process`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            refund_method: method,
            transaction_reference: reference,
          }),
        },
      );

      await readResponse(response);

      clearProcessingForm();

      setMessage(
        "Refund marked as processing. Independent external " +
        "payment confirmation and reconciliation are still required."
      );

      await refresh();
      onChanged?.();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to start refund processing."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Rental refunds for ${rentalReference}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-3 sm:p-6"
    >
      <div className="mx-auto w-full max-w-5xl rounded-2xl bg-white p-4 shadow-2xl sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
          <div>
            <h2 className="text-xl font-bold text-[#263956]">
              Rental Refund Management
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Agreement: {rentalReference}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Rental status: {readable(rentalStatus)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={buttonClass}
          >
            Close
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {message && (
          <p
            role="status"
            className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            {message}
          </p>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">
            Loading refund information...
          </p>
        ) : (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  Available to request
                </p>
                <p className="mt-2 text-lg font-bold text-[#263956]">
                  {money(balance?.available_refund, currency)}
                </p>
              </div>

              <div className="rounded-xl border bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  Reserved refunds
                </p>
                <p className="mt-2 text-lg font-bold text-[#263956]">
                  {money(balance?.reserved_refunds, currency)}
                </p>
              </div>

              <div className="rounded-xl border bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  Existing refund requests
                </p>
                <p className="mt-2 text-lg font-bold text-[#263956]">
                  {refunds.length}
                </p>
              </div>
            </div>

            {canRequest && rentalEnded && (
              <section className="mt-6 rounded-xl border p-4 sm:p-5">
                <h3 className="font-bold text-[#263956]">
                  Request a Refund
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Select a verified rental payment. Submission
                  creates a pending request only.
                </p>

                <form
                  onSubmit={requestRefund}
                  className="mt-4 grid gap-4 sm:grid-cols-2"
                >
                  <label className="block text-sm font-medium">
                    Verified payment
                    <select
                      required
                      value={paymentId}
                      onChange={(event) =>
                        setPaymentId(event.target.value)
                      }
                      className={`${inputClass} mt-1`}
                      disabled={busy}
                    >
                      <option value="">
                        Select verified payment
                      </option>

                      {verifiedPayments.map((payment) => (
                        <option
                          key={payment.id}
                          value={payment.id}
                        >
                          {payment.reference} —{" "}
                          {money(payment.amount, currency)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm font-medium">
                    Refund amount ({currency})
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={amount}
                      onChange={(event) =>
                        setAmount(event.target.value)
                      }
                      placeholder="0.00"
                      className={`${inputClass} mt-1`}
                      disabled={busy}
                    />
                  </label>

                  <label className="block text-sm font-medium sm:col-span-2">
                    Reason for refund
                    <textarea
                      required
                      minLength={5}
                      maxLength={2000}
                      rows={3}
                      value={reason}
                      onChange={(event) =>
                        setReason(event.target.value)
                      }
                      className={`${inputClass} mt-1`}
                      disabled={busy}
                      placeholder="Explain why this rental overpayment should be refunded."
                    />
                  </label>

                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className={primaryClass}
                      disabled={
                        busy ||
                        verifiedPayments.length === 0 ||
                        !balance ||
                        !Number.isFinite(available) ||
                        available <= 0
                      }
                    >
                      {busy
                        ? "Submitting..."
                        : "Submit Refund Request"}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {!rentalEnded && (
              <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                New refund requests require a terminated or
                expired rental agreement.
              </p>
            )}

            <section className="mt-7">
              <h3 className="font-bold text-[#263956]">
                Refund Request History
              </h3>

              {refunds.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No refund requests recorded for this rental.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="p-3">Reference</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Reason</th>
                        <th className="p-3">Requested By</th>
                        <th className="p-3">Review</th>
                        <th className="p-3">Payout Destination</th>
                        <th className="p-3">Processing</th>
                        <th className="p-3">Evidence</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {refunds.map((refund) => (
                        <tr key={refund.id}>
                          <td className="p-3 font-semibold">
                            {refund.reference}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {money(refund.amount, refund.currency)}
                          </td>
                          <td className="p-3 capitalize">
                            {readable(refund.status)}
                          </td>
                          <td className="p-3">
                            <p>{refund.reason}</p>

                            {refund.rejection_reason && (
                              <p className="mt-1 text-xs text-red-700">
                                Rejected: {refund.rejection_reason}
                              </p>
                            )}
                          </td>
                          <td className="p-3">
                            {refund.requester?.name || "—"}
                          </td>
                          <td className="p-3">
                            {canReview &&
                            refund.status === "pending" &&
                            Number.isSafeInteger(refund.requested_by) &&
                            refund.requested_by > 0 &&
                            refund.requested_by !== account.id ? (
                              <div className="flex min-w-[190px] flex-col gap-2">
                                <button
                                  type="button"
                                  disabled={busy}
                                  className={primaryClass}
                                  onClick={() =>
                                    void reviewRefund(refund, "approve")
                                  }
                                >
                                  Approve
                                </button>

                                {rejectingId !== refund.id ? (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    className={buttonClass}
                                    onClick={() => {
                                      setRejectingId(refund.id);
                                      setRejectionReason("");
                                      setError("");
                                    }}
                                  >
                                    Reject
                                  </button>
                                ) : (
                                  <div className="space-y-2">
                                    <label className="block text-xs font-medium">
                                      Rejection reason
                                      <textarea
                                        value={rejectionReason}
                                        onChange={(event) =>
                                          setRejectionReason(event.target.value)
                                        }
                                        minLength={5}
                                        maxLength={2000}
                                        rows={3}
                                        disabled={busy}
                                        className={`${inputClass} mt-1`}
                                      />
                                    </label>

                                    <button
                                      type="button"
                                      disabled={busy}
                                      className={buttonClass}
                                      onClick={() =>
                                        void reviewRefund(refund, "reject")
                                      }
                                    >
                                      Confirm Rejection
                                    </button>

                                    <button
                                      type="button"
                                      disabled={busy}
                                      className={buttonClass}
                                      onClick={() => {
                                        setRejectingId(null);
                                        setRejectionReason("");
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">
                                {refund.status === "pending"
                                  ? "Awaiting independent review"
                                  : "Review completed"}
                              </span>
                            )}
                          </td>

                          <td className="p-3 align-top">
                            {refund.destination ? (
                              <div className="min-w-[195px] space-y-2">
                                <p className="text-sm font-semibold capitalize text-[#263956]">
                                  {readable(refund.destination.status)}
                                </p>

                                {refund.destination.status === "pending" &&
                                  canReview &&
                                  refund.status === "approved" &&
                                  Number.isSafeInteger(refund.requested_by) &&
                                  refund.requested_by > 0 &&
                                  Number.isSafeInteger(refund.destination.recorded_by) &&
                                  refund.destination.recorded_by > 0 &&
                                  refund.requested_by !== account.id &&
                                  refund.destination.recorded_by !== account.id && (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      className={primaryClass}
                                      onClick={() =>
                                        void approveDestination(refund)
                                      }
                                    >
                                      Approve Destination
                                    </button>
                                  )}

                                <p className="text-xs text-slate-500">
                                  Recipient account details are kept private.
                                </p>
                              </div>
                            ) : refund.status === "approved" &&
                              canRecordDestination ? (
                              <div className="min-w-[220px]">
                                {destinationRefundId !== refund.id ? (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    className={buttonClass}
                                    onClick={() => {
                                      clearDestinationForm();
                                      setDestinationRefundId(refund.id);
                                      setError("");
                                    }}
                                  >
                                    Record Destination
                                  </button>
                                ) : (
                                  <form
                                    onSubmit={(event) =>
                                      void saveDestination(event, refund)
                                    }
                                    className="space-y-3"
                                  >
                                    <label className="block text-xs font-medium">
                                      Transfer method
                                      <select
                                        value={destinationMethod}
                                        disabled={busy}
                                        onChange={(event) =>
                                          setDestinationMethod(
                                            event.target.value
                                          )
                                        }
                                        className={`${inputClass} mt-1`}
                                      >
                                        <option value="bank_transfer">
                                          Bank transfer
                                        </option>
                                        <option value="mobile_money">
                                          Mobile money
                                        </option>
                                      </select>
                                    </label>

                                    <label className="block text-xs font-medium">
                                      Recipient name
                                      <input
                                        required
                                        minLength={2}
                                        maxLength={255}
                                        value={recipientName}
                                        onChange={(event) =>
                                          setRecipientName(event.target.value)
                                        }
                                        className={`${inputClass} mt-1`}
                                        disabled={busy}
                                        autoComplete="off"
                                      />
                                    </label>

                                    <label className="block text-xs font-medium">
                                      Account / phone identifier
                                      <input
                                        required
                                        minLength={5}
                                        maxLength={255}
                                        value={recipientIdentifier}
                                        onChange={(event) =>
                                          setRecipientIdentifier(
                                            event.target.value
                                          )
                                        }
                                        className={`${inputClass} mt-1`}
                                        disabled={busy}
                                        autoComplete="off"
                                      />
                                    </label>

                                    <label className="block text-xs font-medium">
                                      Bank / mobile-money provider
                                      <input
                                        required
                                        minLength={2}
                                        maxLength={150}
                                        value={providerName}
                                        onChange={(event) =>
                                          setProviderName(event.target.value)
                                        }
                                        className={`${inputClass} mt-1`}
                                        disabled={busy}
                                        autoComplete="off"
                                      />
                                    </label>

                                    <p className="text-xs text-amber-800">
                                      Verify carefully. A recorded destination
                                      cannot be replaced.
                                    </p>

                                    <button
                                      type="submit"
                                      disabled={busy}
                                      className={primaryClass}
                                    >
                                      {busy
                                        ? "Saving..."
                                        : "Save Destination"}
                                    </button>

                                    <button
                                      type="button"
                                      disabled={busy}
                                      className={buttonClass}
                                      onClick={clearDestinationForm}
                                    >
                                      Cancel
                                    </button>
                                  </form>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">
                                {refund.status === "pending"
                                  ? "Refund approval required"
                                  : "No destination available"}
                              </span>
                            )}
                          </td>

                          <td className="p-3 align-top">
                            {refund.status === "processing" ? (
                              <span className="text-xs font-semibold text-amber-700">
                                Processing — awaiting independent reconciliation
                              </span>
                            ) : refund.status === "paid" ? (
                              <span className="text-xs font-semibold text-emerald-700">
                                Reconciled as paid
                              </span>
                            ) : refund.status === "failed" ? (
                              <span className="text-xs font-semibold text-red-700">
                                Transfer failed
                              </span>
                            ) : refund.status === "approved" &&
                              refund.destination?.status === "approved" &&
                              canProcess &&
                              rentalEnded &&
                              Number.isSafeInteger(refund.requested_by) &&
                              refund.requested_by > 0 &&
                              Number.isSafeInteger(refund.approved_by) &&
                              (refund.approved_by ?? 0) > 0 &&
                              refund.requested_by !== account.id &&
                              refund.approved_by !== account.id ? (
                              <div className="min-w-[220px]">
                                {processingRefundId !== refund.id ? (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    className={primaryClass}
                                    onClick={() => {
                                      clearProcessingForm();
                                      setProcessingRefundId(refund.id);
                                      setError("");
                                    }}
                                  >
                                    Start Processing
                                  </button>
                                ) : (
                                  <form
                                    onSubmit={(event) =>
                                      void startRefundProcessing(event, refund)
                                    }
                                    className="space-y-3"
                                  >
                                    <p className="text-xs text-slate-600">
                                      Approved method:
                                      {" "}
                                      {readable(
                                        refund.destination.refund_method
                                      )}
                                    </p>

                                    <label className="block text-xs font-medium">
                                      Transfer transaction reference
                                      <input
                                        type="text"
                                        required
                                        minLength={5}
                                        maxLength={255}
                                        autoComplete="off"
                                        value={processingReference}
                                        onChange={(event) =>
                                          setProcessingReference(
                                            event.target.value
                                          )
                                        }
                                        disabled={busy}
                                        className={`${inputClass} mt-1`}
                                      />
                                    </label>

                                    <p className="text-xs text-amber-800">
                                      Record a real submitted transfer reference.
                                      This does not confirm settlement.
                                    </p>

                                    <button
                                      type="submit"
                                      disabled={busy}
                                      className={primaryClass}
                                    >
                                      {busy
                                        ? "Submitting..."
                                        : "Confirm Processing"}
                                    </button>

                                    <button
                                      type="button"
                                      disabled={busy}
                                      className={buttonClass}
                                      onClick={clearProcessingForm}
                                    >
                                      Cancel
                                    </button>
                                  </form>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">
                                {refund.status === "approved"
                                  ? "Approved destination and independent processor required"
                                  : "Not ready for processing"}
                              </span>
                            )}
                          </td>

                          <td className="p-3 align-top">
                            {canViewEvidence ? (
                              <button
                                type="button"
                                disabled={busy}
                                className={buttonClass}
                                onClick={() => chooseEvidenceRefund(refund.id)}
                              >
                                {selectedEvidenceRefundId === refund.id
                                  ? "Hide Evidence"
                                  : "View Evidence"}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-500">
                                Restricted
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>


            {selectedEvidenceRefundId !== null && canViewEvidence && (
              <section className="mt-6 rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-[#263956]">
                      Refund Evidence
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Refund:{" "}
                      {refunds.find(
                        (item) => item.id === selectedEvidenceRefundId,
                      )?.reference || selectedEvidenceRefundId}
                    </p>
                  </div>

                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => chooseEvidenceRefund(null)}
                  >
                    Close Evidence
                  </button>
                </div>


                {canUploadEvidence &&
                  refunds.some(
                    (item) =>
                      item.id === selectedEvidenceRefundId &&
                      ["approved", "processing"].includes(item.status),
                  ) && (
                    <form
                      onSubmit={(event) =>
                        void uploadRefundEvidence(event)
                      }
                      className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <h4 className="text-sm font-semibold text-[#263956]">
                        Upload Refund Evidence
                      </h4>

                      <p className="text-xs text-slate-600">
                        Attach an external bank or mobile-money
                        transaction record. Uploading evidence does not
                        confirm payment.
                      </p>

                      <label className="block text-sm font-medium text-slate-700">
                        Evidence file
                        <input
                          key={evidenceInputKey}
                          type="file"
                          required
                          accept=".pdf,.jpg,.jpeg,.png"
                          disabled={busy}
                          onChange={(event) =>
                            setEvidenceFile(
                              event.target.files?.[0] || null,
                            )
                          }
                          className={`${inputClass} mt-2`}
                        />
                      </label>

                      <p className="text-xs text-slate-500">
                        PDF, JPG, JPEG or PNG. Maximum 5 MB.
                      </p>

                      <button
                        type="submit"
                        disabled={busy || !evidenceFile}
                        className={primaryClass}
                      >
                        {busy
                          ? "Uploading..."
                          : "Upload Evidence"}
                      </button>
                    </form>
                  )}

                {evidenceError && (
                  <p
                    role="alert"
                    className="mt-3 text-sm text-red-700"
                  >
                    {evidenceError}
                  </p>
                )}

                {evidenceLoading ? (
                  <p className="mt-4 text-sm text-slate-500">
                    Loading evidence...
                  </p>
                ) : refundEvidences.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">
                    No evidence files recorded for this refund.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {refundEvidences.map((evidence) => (
                      <div
                        key={evidence.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
                      >
                        <div className="min-w-0">
                          <p className="break-all text-sm font-semibold text-[#263956]">
                            {evidence.original_name}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Uploaded by:{" "}
                            {evidence.uploader?.name || "Authorized staff"}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {evidence.verified_at
                              ? "Evidence reviewed"
                              : "Awaiting independent verification"}
                          </p>
                        </div>

                        <a
                          href={
                            `/api/dashboard/rental-refund-evidence/` +
                            `${rentalId}/${selectedEvidenceRefundId}/` +
                            `${evidence.id}/download`
                          }
                          className={buttonClass}
                        >
                          Download Evidence
                        </a>
                      </div>
                    ))}
                  </div>
                )}


                {(() => {
                  const refund = refunds.find(
                    (item) => item.id === selectedEvidenceRefundId,
                  );

                  if (
                    !refund ||
                    !canReconcileRefund(refund) ||
                    evidenceLoading ||
                    evidenceLoadedRefundId !== refund.id
                  ) {
                    return null;
                  }

                  const update = (
                    field: keyof typeof reconciliation,
                    value: string | boolean,
                  ) => {
                    setReconciliation((previous) => ({
                      ...previous,
                      [field]: value,
                    }));
                  };

                  return (
                    <form
                      onSubmit={(event) =>
                        void reconcileRefund(event, refund)
                      }
                      className="mt-5 space-y-3 rounded-xl border border-slate-300 bg-slate-50 p-4"
                    >
                      <h4 className="font-bold text-[#263956]">
                        Independent Refund Reconciliation
                      </h4>

                      <p className="text-xs text-amber-800">
                        Check the actual bank or provider record yourself.
                        Do not rely only on uploaded evidence.
                        This action can finalize the refund.
                      </p>

                      <p className="text-sm text-slate-700">
                        Approved refund:{" "}
                        <strong>
                          {money(refund.amount, refund.currency)}
                        </strong>
                      </p>

                      <label className="block text-sm font-medium">
                        Supporting evidence
                        <select
                          required
                          className={`${inputClass} mt-1`}
                          value={reconciliation.evidenceId}
                          onChange={(event) =>
                            update("evidenceId", event.target.value)
                          }
                          disabled={busy || evidenceLoading}
                        >
                          <option value="">Select evidence</option>
                          {refundEvidences
                            .filter(
                              (item) =>
                                Number.isSafeInteger(item.uploaded_by) &&
                                item.uploaded_by > 0 &&
                                item.uploaded_by !== account.id,
                            )
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.original_name} (#{item.id})
                              </option>
                            ))}
                        </select>
                      </label>

                      <label className="block text-sm font-medium">
                        External confirmation source
                        <select
                          required
                          className={`${inputClass} mt-1`}
                          value={reconciliation.confirmationSource}
                          onChange={(event) =>
                            update(
                              "confirmationSource",
                              event.target.value,
                            )
                          }
                          disabled={busy}
                        >
                          <option value="">Select source</option>
                          <option value="bank_statement">
                            Bank statement
                          </option>
                          <option value="provider_portal">
                            Payment provider portal
                          </option>
                        </select>
                      </label>

                      {([
                        ["reference", "Verified transaction reference"],
                        ["amount", "Verified amount"],
                        ["currency", "Verified currency"],
                        ["recipient", "Verified recipient account or phone"],
                      ] as const).map(([field, label]) => (
                        <label
                          key={field}
                          className="block text-sm font-medium"
                        >
                          {label}
                          <input
                            required
                            autoComplete="off"
                            className={`${inputClass} mt-1`}
                            value={reconciliation[field]}
                            onChange={(event) =>
                              update(field, event.target.value)
                            }
                            disabled={busy}
                          />
                        </label>
                      ))}

                      <p className="text-xs text-slate-600">
                        The reference, amount, currency and recipient
                        must match the approved refund and destination.
                        Enter what you verified externally.
                      </p>

                      <label className="block text-sm font-medium">
                        Provider confirmation date and time
                        <input
                          required
                          type="datetime-local"
                          className={`${inputClass} mt-1`}
                          value={reconciliation.confirmedAt}
                          onChange={(event) =>
                            update("confirmedAt", event.target.value)
                          }
                          disabled={busy}
                        />
                      </label>

                      <label className="block text-sm font-medium">
                        Verified outcome
                        <select
                          required
                          className={`${inputClass} mt-1`}
                          value={reconciliation.outcome}
                          onChange={(event) =>
                            update("outcome", event.target.value)
                          }
                          disabled={busy}
                        >
                          <option value="">Select outcome</option>
                          <option value="success">
                            Success — mark refund Paid
                          </option>
                          <option value="failed">
                            Failed — mark refund Failed
                          </option>
                        </select>
                      </label>

                      <label className="block text-sm font-medium">
                        Verification notes (minimum 20 characters)
                        <textarea
                          required
                          minLength={20}
                          maxLength={3000}
                          rows={4}
                          className={`${inputClass} mt-1`}
                          value={reconciliation.notes}
                          onChange={(event) =>
                            update("notes", event.target.value)
                          }
                          disabled={busy}
                        />
                      </label>

                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          required
                          className="mt-1"
                          checked={reconciliation.externalRecordChecked}
                          onChange={(event) =>
                            update(
                              "externalRecordChecked",
                              event.target.checked,
                            )
                          }
                          disabled={busy}
                        />
                        <span>
                          I independently checked the actual external
                          bank or provider record and verified all details.
                        </span>
                      </label>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          className={primaryClass}
                          disabled={
                            busy ||
                            evidenceLoading ||
                            !reconciliation.externalRecordChecked
                          }
                        >
                          {busy
                            ? "Submitting..."
                            : "Confirm Reconciliation"}
                        </button>

                        <button
                          type="button"
                          className={buttonClass}
                          disabled={busy}
                          onClick={resetReconciliation}
                        >
                          Clear Form
                        </button>
                      </div>
                    </form>
                  );
                })()}

                <p className="mt-4 text-xs text-slate-500">
                  Downloads require an authenticated session.
                  Evidence alone does not confirm that a refund
                  has been paid.
                </p>
              </section>
            )}

            <p className="mt-5 text-xs text-slate-500">
              Refund approval, transfer processing, and independent
              payout reconciliation are separate controlled steps.
              Submitting a request does not transfer money.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
