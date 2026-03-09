export const ROLES = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  CASHIER: "CASHIER",
  WAREHOUSE: "WAREHOUSE",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const PAYMENT_METHODS = {
  CASH: "CASH",
  BANK: "BANK",
  DEBT: "DEBT",
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export const INVOICE_STATUSES = {
  COMPLETED: "COMPLETED",
  VOID: "VOID",
} as const;

export const STOCK_REF_TYPES = {
  PURCHASE_RECEIPT: "PURCHASE_RECEIPT",
  SALE: "SALE",
  STOCK_ADJUST: "STOCK_ADJUST",
  TRANSFER_OUT: "TRANSFER_OUT",
  TRANSFER_IN: "TRANSFER_IN",
  VOID_SALE: "VOID_SALE",
  SALE_RETURN: "SALE_RETURN",
} as const;

export const AUDIT_ACTIONS = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  VOID: "VOID",
  LOGIN: "LOGIN",
  PRICE_TIER_CHANGE: "PRICE_TIER_CHANGE",
} as const;
