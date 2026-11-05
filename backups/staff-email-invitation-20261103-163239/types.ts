export type StaffMember = {
  id: number;
  name: string;
  email: string;
  status: string;
  roles: string[];
  created_at?: string;
};

export type StaffPage = {
  members: StaffMember[];
  currentPage: number;
  lastPage: number;
  total: number;
};

export type StaffFormValues = {
  name: string;
  email: string;
  role: string;
  password: string;
  password_confirmation: string;
};

export type ApiError = {
  message?: string;
  errors?: Record<string, string[]>;
};

export function getErrorMessage(
  result: unknown,
  fallback: string,
): string {
  if (typeof result !== "object" || result === null) {
    return fallback;
  }

  const data = result as ApiError;

  if (data.errors && typeof data.errors === "object") {
    const first = Object.values(data.errors)[0];

    if (Array.isArray(first) && typeof first[0] === "string") {
      return first[0];
    }
  }

  return typeof data.message === "string"
    ? data.message
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMember(value: unknown): StaffMember | null {
  if (!isRecord(value)) return null;

  if (
    typeof value.id !== "number" ||
    typeof value.name !== "string" ||
    typeof value.email !== "string"
  ) {
    return null;
  }

  const roles = Array.isArray(value.roles)
    ? value.roles
        .map((role) => {
          if (typeof role === "string") return role;
          if (isRecord(role) && typeof role.name === "string") {
            return role.name;
          }
          return null;
        })
        .filter((role): role is string => role !== null)
    : [];

  return {
    id: value.id,
    name: value.name,
    email: value.email,
    status: typeof value.status === "string" ? value.status : "unknown",
    roles,
    created_at:
      typeof value.created_at === "string"
        ? value.created_at
        : undefined,
  };
}

export function parseStaffPage(response: unknown): StaffPage {
  if (!isRecord(response)) {
    throw new Error("Invalid staff response.");
  }

  // Supports both a standard Laravel paginator and
  // a paginator nested under the "users" key.
  const source = isRecord(response.users)
    ? response.users
    : response;

  const rows = Array.isArray(source.data)
    ? source.data
    : Array.isArray(response.users)
      ? response.users
      : [];

  const members = rows
    .map(normalizeMember)
    .filter((member): member is StaffMember => member !== null);

  const page = Number(source.current_page ?? 1);
  const last = Number(source.last_page ?? 1);
  const total = Number(source.total ?? members.length);

  return {
    members,
    currentPage: Number.isFinite(page) ? page : 1,
    lastPage: Number.isFinite(last) ? last : 1,
    total: Number.isFinite(total) ? total : members.length,
  };
}

export function parseRoles(response: unknown): string[] {
  if (!isRecord(response)) return [];

  const rows = Array.isArray(response.roles)
    ? response.roles
    : Array.isArray(response.data)
      ? response.data
      : [];

  return rows
    .map((item) => {
      if (typeof item === "string") return item;
      if (isRecord(item) && typeof item.name === "string") {
        return item.name;
      }
      return null;
    })
    .filter((role): role is string => role !== null);
}
