import { prisma } from "../../db/prisma";
import { AppError } from "../../utils/appError";

// ── Types ──────────────────────────────────────────────
export const DEBT_TYPES = {
    /** Khách nợ thêm (mua hàng chưa trả đủ) */
    INCUR: "INCUR",
    /** Khách trả nợ */
    PAYMENT: "PAYMENT",
    /** Điều chỉnh tăng nợ */
    ADJUST_UP: "ADJUST_UP",
    /** Điều chỉnh giảm nợ */
    ADJUST_DOWN: "ADJUST_DOWN",
} as const;

export type DebtType = (typeof DEBT_TYPES)[keyof typeof DEBT_TYPES];

// ── Helpers ────────────────────────────────────────────
/** Get current debt balance for a customer (sum of all transactions).
 *  Positive = customer owes us.
 */
export const getCustomerBalance = async (customerId: number): Promise<number> => {
    const last = await prisma.debtTransaction.findFirst({
        where: { customerId },
        orderBy: { id: "desc" },
    });
    return last?.balanceAfter ?? 0;
};

// ── Incur debt (called from createSale) ────────────────
export const incurDebt = async (
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    data: {
        customerId: number;
        invoiceId: number;
        amount: number;
        createdById: number;
    }
) => {
    if (data.amount <= 0) return null;

    // Get current balance inside tx
    const last = await tx.debtTransaction.findFirst({
        where: { customerId: data.customerId },
        orderBy: { id: "desc" },
    });
    const currentBalance = last?.balanceAfter ?? 0;

    // Check debt limit
    const customer = await tx.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) throw new AppError("Customer not found", 404);

    const newBalance = currentBalance + data.amount;
    if (customer.debtLimit > 0 && newBalance > customer.debtLimit) {
        throw new AppError(
            `Vượt hạn mức nợ. Hạn mức: ${customer.debtLimit.toLocaleString("vi-VN")}đ, Nợ hiện tại: ${currentBalance.toLocaleString("vi-VN")}đ, Nợ thêm: ${data.amount.toLocaleString("vi-VN")}đ`,
            400
        );
    }

    return tx.debtTransaction.create({
        data: {
            customerId: data.customerId,
            invoiceId: data.invoiceId,
            type: DEBT_TYPES.INCUR,
            amount: data.amount,
            balanceAfter: newBalance,
            note: `Nợ từ hóa đơn`,
            createdById: data.createdById,
        },
    });
};

// ── Record debt payment ────────────────────────────────
export const recordDebtPayment = async (input: {
    customerId: number;
    amount: number;
    note?: string;
    createdById: number;
}) => {
    if (input.amount <= 0) throw new AppError("Số tiền trả nợ phải lớn hơn 0", 400);

    const currentBalance = await getCustomerBalance(input.customerId);
    if (currentBalance <= 0) throw new AppError("Khách hàng không có nợ", 400);
    if (input.amount > currentBalance) {
        throw new AppError(`Số tiền trả vượt quá nợ hiện tại (${currentBalance.toLocaleString("vi-VN")}đ)`, 400);
    }

    const newBalance = currentBalance - input.amount;

    return prisma.debtTransaction.create({
        data: {
            customerId: input.customerId,
            type: DEBT_TYPES.PAYMENT,
            amount: input.amount,
            balanceAfter: newBalance,
            note: input.note || "Trả nợ",
            createdById: input.createdById,
        },
        include: {
            customer: true,
        },
    });
};

// ── Adjust debt ────────────────────────────────────────
export const adjustDebt = async (input: {
    customerId: number;
    amount: number;
    type: "ADJUST_UP" | "ADJUST_DOWN";
    note: string;
    createdById: number;
}) => {
    if (input.amount <= 0) throw new AppError("Số tiền điều chỉnh phải lớn hơn 0", 400);

    const currentBalance = await getCustomerBalance(input.customerId);
    const newBalance =
        input.type === DEBT_TYPES.ADJUST_UP
            ? currentBalance + input.amount
            : Math.max(0, currentBalance - input.amount);

    return prisma.debtTransaction.create({
        data: {
            customerId: input.customerId,
            type: input.type,
            amount: input.amount,
            balanceAfter: newBalance,
            note: input.note,
            createdById: input.createdById,
        },
        include: {
            customer: true,
        },
    });
};

// ── List customers with debt summary ───────────────────
export const listCustomersWithDebt = async () => {
    const customers = await prisma.customer.findMany({
        orderBy: { name: "asc" },
    });

    // Get last transaction for each customer to get current balance
    const result = await Promise.all(
        customers.map(async (c) => {
            const lastTx = await prisma.debtTransaction.findFirst({
                where: { customerId: c.id },
                orderBy: { id: "desc" },
            });
            return {
                ...c,
                currentDebt: lastTx?.balanceAfter ?? 0,
            };
        })
    );

    return result;
};

// ── Debt history for a customer ────────────────────────
export const getDebtHistory = async (
    customerId: number,
    opts: { page?: number; pageSize?: number } = {}
) => {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;

    const [items, total] = await Promise.all([
        prisma.debtTransaction.findMany({
            where: { customerId },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: {
                invoice: { select: { id: true, code: true, total: true } },
                createdBy: { select: { id: true, email: true, fullName: true } },
            },
        }),
        prisma.debtTransaction.count({ where: { customerId } }),
    ]);

    return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    };
};

// ── Update customer debt limit ─────────────────────────
export const updateCustomerDebtLimit = async (customerId: number, debtLimit: number) => {
    if (debtLimit < 0) throw new AppError("Hạn mức nợ không được âm", 400);

    return prisma.customer.update({
        where: { id: customerId },
        data: { debtLimit },
    });
};

// ── Customers with overdue debts (for reminders) ───────
export const getDebtReminders = async () => {
    const customers = await prisma.customer.findMany({
        orderBy: { name: "asc" },
    });

    const result = [];
    for (const c of customers) {
        const lastTx = await prisma.debtTransaction.findFirst({
            where: { customerId: c.id },
            orderBy: { id: "desc" },
        });
        const currentDebt = lastTx?.balanceAfter ?? 0;
        if (currentDebt <= 0) continue;

        // Get the oldest unpaid INCUR transaction date
        const oldestIncur = await prisma.debtTransaction.findFirst({
            where: {
                customerId: c.id,
                type: DEBT_TYPES.INCUR,
            },
            orderBy: { createdAt: "asc" },
        });

        const debtAgeDays = oldestIncur
            ? Math.floor((Date.now() - new Date(oldestIncur.createdAt).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

        const isOverLimit = c.debtLimit > 0 && currentDebt > c.debtLimit;

        result.push({
            ...c,
            currentDebt,
            debtAgeDays,
            isOverLimit,
            oldestDebtDate: oldestIncur?.createdAt ?? null,
        });
    }

    // Sort: over limit first, then by debt amount descending
    result.sort((a, b) => {
        if (a.isOverLimit && !b.isOverLimit) return -1;
        if (!a.isOverLimit && b.isOverLimit) return 1;
        return b.currentDebt - a.currentDebt;
    });

    return result;
};
