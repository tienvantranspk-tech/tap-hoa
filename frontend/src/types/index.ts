export type Role = "ADMIN" | "MANAGER" | "CASHIER" | "WAREHOUSE";

export type User = {
  id: number;
  email: string;
  role: Role;
  fullName?: string | null;
};

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type PriceTier = {
  id: number;
  name: string;
  price: number;
};

export type Product = {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  unit: string;
  priceTierId?: number | null;
  customPrice?: number | null;
  cost: number;
  active: boolean;
  minStock: number;
  priceTier?: PriceTier | null;
  stockQty?: number;
  promoPrice?: number | null;
  promoStartAt?: string | null;
  promoEndAt?: string | null;
};

export type Customer = {
  id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  debtLimit?: number;
  currentDebt?: number;
};

export type Supplier = {
  id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
};

export type Warehouse = {
  id: number;
  name: string;
  location?: string | null;
  stockQty?: number;
};

export type SalesInvoice = {
  id: number;
  code: string;
  subtotal: number;
  discount: number;
  total: number;
  status: "COMPLETED" | "VOID";
  createdAt: string;
  customer?: Customer;
  warehouse?: Warehouse;
  lines: Array<{
    id: number;
    qty: number;
    unitPrice: number;
    unitCost: number;
    lineTotal: number;
    product: Product;
  }>;
  payments: Array<{
    id: number;
    method: "CASH" | "BANK" | "DEBT";
    amount: number;
  }>;
};

export type PurchaseReceipt = {
  id: number;
  code: string;
  totalCost: number;
  createdAt: string;
};

export type AuditLog = {
  id: number;
  entity: string;
  entityId: string;
  action: string;
  beforeJson?: string | null;
  afterJson?: string | null;
  createdAt: string;
  createdBy?: User | null;
};

export type RestockSuggestion = {
  product: Product;
  stockQty: number;
  minStock: number;
  suggestedQty: number;
  estimatedCost: number;
};

export type DebtTransaction = {
  id: number;
  customerId: number;
  invoiceId?: number | null;
  type: "INCUR" | "PAYMENT" | "ADJUST_UP" | "ADJUST_DOWN";
  amount: number;
  balanceAfter: number;
  note?: string | null;
  createdAt: string;
  invoice?: { id: number; code: string; total: number } | null;
  createdBy?: { id: number; email: string; fullName?: string | null } | null;
};

export type DebtCustomerSummary = {
  id: number;
  name: string;
  phone?: string | null;
  debtLimit: number;
  currentDebt: number;
  debtAgeDays?: number;
  isOverLimit?: boolean;
  oldestDebtDate?: string | null;
};

