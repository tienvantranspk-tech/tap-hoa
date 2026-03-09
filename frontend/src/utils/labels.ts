import type { Role } from "../types";

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý",
  CASHIER: "Thu ngân",
  WAREHOUSE: "Kho",
};

export const roleLabel = (role?: Role | null) => {
  if (!role) return "";
  return ROLE_LABELS[role] ?? role;
};
