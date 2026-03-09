import { useEffect, useState } from "react";
import { apiRequest } from "../../api/client";
import { Modal } from "../../components/Modal";
import type { DebtCustomerSummary, DebtTransaction, PaginatedResponse } from "../../types";

const money = (v: number) => v.toLocaleString("vi-VN");

const debtTypeLabel: Record<string, string> = {
    INCUR: "Phát sinh nợ",
    PAYMENT: "Trả nợ",
    ADJUST_UP: "Điều chỉnh tăng",
    ADJUST_DOWN: "Điều chỉnh giảm",
};

const debtTypeColor: Record<string, string> = {
    INCUR: "text-red-600",
    PAYMENT: "text-green-600",
    ADJUST_UP: "text-red-600",
    ADJUST_DOWN: "text-green-600",
};

type Tab = "overview" | "reminders";

export const DebtsPage = () => {
    const [tab, setTab] = useState<Tab>("overview");
    const [customers, setCustomers] = useState<DebtCustomerSummary[]>([]);
    const [reminders, setReminders] = useState<DebtCustomerSummary[]>([]);
    const [search, setSearch] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Payment modal
    const [payModal, setPayModal] = useState(false);
    const [payCustomer, setPayCustomer] = useState<DebtCustomerSummary | null>(null);
    const [payAmount, setPayAmount] = useState("");
    const [payNote, setPayNote] = useState("");

    // Adjust modal
    const [adjModal, setAdjModal] = useState(false);
    const [adjCustomer, setAdjCustomer] = useState<DebtCustomerSummary | null>(null);
    const [adjAmount, setAdjAmount] = useState("");
    const [adjType, setAdjType] = useState<"ADJUST_UP" | "ADJUST_DOWN">("ADJUST_DOWN");
    const [adjNote, setAdjNote] = useState("");

    // Debt limit modal
    const [limitModal, setLimitModal] = useState(false);
    const [limitCustomer, setLimitCustomer] = useState<DebtCustomerSummary | null>(null);
    const [limitValue, setLimitValue] = useState("");

    // History modal
    const [historyModal, setHistoryModal] = useState(false);
    const [historyCustomer, setHistoryCustomer] = useState<DebtCustomerSummary | null>(null);
    const [historyRows, setHistoryRows] = useState<DebtTransaction[]>([]);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyTotalPages, setHistoryTotalPages] = useState(1);

    const loadCustomers = async () => {
        try {
            const data = await apiRequest<DebtCustomerSummary[]>("/debts");
            setCustomers(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Tải dữ liệu thất bại");
        }
    };

    const loadReminders = async () => {
        try {
            const data = await apiRequest<DebtCustomerSummary[]>("/debts/reminders");
            setReminders(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Tải nhắc nợ thất bại");
        }
    };

    const loadHistory = async (customerId: number, page = 1) => {
        try {
            const data = await apiRequest<PaginatedResponse<DebtTransaction>>(
                `/debts/${customerId}/history?page=${page}&pageSize=15`
            );
            setHistoryRows(data.items);
            setHistoryPage(data.page);
            setHistoryTotalPages(data.totalPages);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Tải lịch sử thất bại");
        }
    };

    useEffect(() => {
        loadCustomers();
        loadReminders();
    }, []);

    const flash = (msg: string) => {
        setSuccess(msg);
        setTimeout(() => setSuccess(null), 3000);
    };

    // ── Payment ──
    const openPay = (c: DebtCustomerSummary) => {
        setPayCustomer(c);
        setPayAmount("");
        setPayNote("");
        setPayModal(true);
    };

    const submitPay = async () => {
        if (!payCustomer) return;
        try {
            await apiRequest(`/debts/${payCustomer.id}/payment`, {
                method: "POST",
                body: JSON.stringify({ amount: Number(payAmount), note: payNote }),
            });
            setPayModal(false);
            flash("Ghi nhận trả nợ thành công");
            loadCustomers();
            loadReminders();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Trả nợ thất bại");
        }
    };

    // ── Adjust ──
    const openAdj = (c: DebtCustomerSummary) => {
        setAdjCustomer(c);
        setAdjAmount("");
        setAdjType("ADJUST_DOWN");
        setAdjNote("");
        setAdjModal(true);
    };

    const submitAdj = async () => {
        if (!adjCustomer || !adjNote.trim()) {
            setError("Vui lòng nhập lý do điều chỉnh");
            return;
        }
        try {
            await apiRequest(`/debts/${adjCustomer.id}/adjust`, {
                method: "POST",
                body: JSON.stringify({
                    amount: Number(adjAmount),
                    type: adjType,
                    note: adjNote,
                }),
            });
            setAdjModal(false);
            flash("Điều chỉnh nợ thành công");
            loadCustomers();
            loadReminders();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Điều chỉnh thất bại");
        }
    };

    // ── Debt Limit ──
    const openLimit = (c: DebtCustomerSummary) => {
        setLimitCustomer(c);
        setLimitValue(String(c.debtLimit || 0));
        setLimitModal(true);
    };

    const submitLimit = async () => {
        if (!limitCustomer) return;
        try {
            await apiRequest(`/debts/${limitCustomer.id}/limit`, {
                method: "PUT",
                body: JSON.stringify({ debtLimit: Number(limitValue) }),
            });
            setLimitModal(false);
            flash("Cập nhật hạn mức nợ thành công");
            loadCustomers();
            loadReminders();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Cập nhật thất bại");
        }
    };

    // ── History ──
    const openHistory = (c: DebtCustomerSummary) => {
        setHistoryCustomer(c);
        loadHistory(c.id, 1);

        // Cuộn xuống phần lịch sử
        setTimeout(() => {
            document.getElementById("history-section")?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const filtered = customers.filter(
        (c) =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            (c.phone ?? "").includes(search)
    );

    const customersWithDebt = filtered.filter((c) => c.currentDebt > 0);
    const customersNoDebt = filtered.filter((c) => c.currentDebt <= 0);
    const totalDebt = customers.reduce((s, c) => s + c.currentDebt, 0);
    const totalCustomersWithDebt = customers.filter((c) => c.currentDebt > 0).length;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl font-bold text-brand-800">💰 Quản lý công nợ</h2>
                    <div className="flex rounded-lg border border-brand-200 p-0.5">
                        <button
                            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${tab === "overview" ? "bg-brand-500 text-white shadow-sm" : "text-brand-600 hover:bg-brand-50"}`}
                            onClick={() => setTab("overview")}
                        >
                            Tổng quan
                        </button>
                        <button
                            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${tab === "reminders" ? "bg-brand-500 text-white shadow-sm" : "text-brand-600 hover:bg-brand-50"}`}
                            onClick={() => setTab("reminders")}
                        >
                            Nhắc đòi nợ ({reminders.length})
                        </button>
                    </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <div className="rounded-lg bg-brand-50 p-3">
                        <p className="text-sm text-brand-700">Tổng công nợ</p>
                        <p className="text-xl font-black text-red-600">{money(totalDebt)} đ</p>
                    </div>
                    <div className="rounded-lg bg-brand-50 p-3">
                        <p className="text-sm text-brand-700">Khách đang nợ</p>
                        <p className="text-xl font-black text-brand-800">{totalCustomersWithDebt} khách</p>
                    </div>
                    <div className="rounded-lg bg-brand-50 p-3">
                        <p className="text-sm text-brand-700">Vượt hạn mức</p>
                        <p className="text-xl font-black text-orange-600">
                            {reminders.filter((r) => r.isOverLimit).length} khách
                        </p>
                    </div>
                </div>
            </div>

            {success && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">
                    ✅ {success}
                </div>
            )}
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                    ❌ {error}
                    <button className="ml-2 underline" onClick={() => setError(null)}>
                        Đóng
                    </button>
                </div>
            )}

            {/* ═══ OVERVIEW TAB ═══ */}
            {tab === "overview" && (
                <div className="card p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg font-bold text-brand-800">Danh sách khách hàng</h3>
                        <input
                            className="input w-64"
                            placeholder="Tìm tên hoặc SĐT..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Customers with debt */}
                    {customersWithDebt.length > 0 && (
                        <>
                            <h4 className="mb-2 text-sm font-semibold text-red-600">
                                Khách đang nợ ({customersWithDebt.length})
                            </h4>
                            <table className="mb-4 w-full text-sm">
                                <thead>
                                    <tr className="border-b border-brand-200 text-left">
                                        <th className="py-2">Khách hàng</th>
                                        <th className="py-2">SĐT</th>
                                        <th className="py-2 text-right">Nợ hiện tại</th>
                                        <th className="py-2 text-right">Hạn mức</th>
                                        <th className="py-2 text-center">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customersWithDebt.map((c) => (
                                        <tr key={c.id} className="border-b border-brand-100">
                                            <td className="py-2 font-medium">{c.name}</td>
                                            <td className="py-2 text-brand-600">{c.phone || "-"}</td>
                                            <td className="py-2 text-right font-bold text-red-600">{money(c.currentDebt)} đ</td>
                                            <td className="py-2 text-right">
                                                {c.debtLimit > 0 ? (
                                                    <span className={c.currentDebt > c.debtLimit ? "font-bold text-orange-600" : ""}>
                                                        {money(c.debtLimit)} đ
                                                    </span>
                                                ) : (
                                                    <span className="text-brand-400">Không giới hạn</span>
                                                )}
                                            </td>
                                            <td className="py-2 text-center">
                                                <div className="flex flex-wrap justify-center gap-1">
                                                    <button className="btn-primary text-xs" onClick={() => openPay(c)}>
                                                        Thu nợ
                                                    </button>
                                                    <button className="btn-light text-xs" onClick={() => openHistory(c)}>
                                                        Lịch sử
                                                    </button>
                                                    <button className="btn-light text-xs" onClick={() => openAdj(c)}>
                                                        Điều chỉnh
                                                    </button>
                                                    <button className="btn-light text-xs" onClick={() => openLimit(c)}>
                                                        Hạn mức
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}

                    {/* Customers without debt */}
                    {customersNoDebt.length > 0 && (
                        <>
                            <h4 className="mb-2 text-sm font-semibold text-green-600">
                                Khách không nợ ({customersNoDebt.length})
                            </h4>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-brand-200 text-left">
                                        <th className="py-2">Khách hàng</th>
                                        <th className="py-2">SĐT</th>
                                        <th className="py-2 text-right">Nợ hiện tại</th>
                                        <th className="py-2 text-right">Hạn mức</th>
                                        <th className="py-2 text-center">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customersNoDebt.map((c) => (
                                        <tr key={c.id} className="border-b border-brand-100">
                                            <td className="py-2 font-medium">{c.name}</td>
                                            <td className="py-2 text-brand-600">{c.phone || "-"}</td>
                                            <td className="py-2 text-right font-bold text-brand-700">{money(c.currentDebt)} đ</td>
                                            <td className="py-2 text-right">
                                                {c.debtLimit > 0 ? `${money(c.debtLimit)} đ` : <span className="text-brand-400">Không giới hạn</span>}
                                            </td>
                                            <td className="py-2 text-center">
                                                <div className="flex flex-wrap justify-center gap-1">
                                                    <button className="btn-light text-xs" onClick={() => openHistory(c)}>
                                                        Lịch sử
                                                    </button>
                                                    <button className="btn-light text-xs" onClick={() => openLimit(c)}>
                                                        Hạn mức
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>
            )}

            {/* ═══ REMINDERS TAB ═══ */}
            {tab === "reminders" && (
                <div className="card p-4">
                    <h3 className="mb-3 text-lg font-bold text-brand-800">🔔 Danh sách nhắc đòi nợ</h3>
                    {reminders.length === 0 ? (
                        <p className="text-brand-500">Không có khách hàng nào đang nợ.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-brand-200 text-left">
                                    <th className="py-2">Khách hàng</th>
                                    <th className="py-2">SĐT</th>
                                    <th className="py-2 text-right">Nợ hiện tại</th>
                                    <th className="py-2 text-right">Hạn mức</th>
                                    <th className="py-2 text-right">Số ngày nợ</th>
                                    <th className="py-2 text-center">Trạng thái</th>
                                    <th className="py-2 text-center">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reminders.map((c) => (
                                    <tr key={c.id} className="border-b border-brand-100">
                                        <td className="py-2 font-medium">{c.name}</td>
                                        <td className="py-2 text-brand-600">{c.phone || "-"}</td>
                                        <td className="py-2 text-right font-bold text-red-600">{money(c.currentDebt)} đ</td>
                                        <td className="py-2 text-right">
                                            {c.debtLimit > 0 ? `${money(c.debtLimit)} đ` : "-"}
                                        </td>
                                        <td className="py-2 text-right">
                                            <span className={`font-semibold ${(c.debtAgeDays ?? 0) > 30 ? "text-red-600" : (c.debtAgeDays ?? 0) > 7 ? "text-orange-600" : "text-brand-700"}`}>
                                                {c.debtAgeDays ?? 0} ngày
                                            </span>
                                        </td>
                                        <td className="py-2 text-center">
                                            {c.isOverLimit ? (
                                                <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                                                    Vượt hạn mức
                                                </span>
                                            ) : (c.debtAgeDays ?? 0) > 30 ? (
                                                <span className="inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
                                                    Nợ lâu
                                                </span>
                                            ) : (
                                                <span className="inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-700">
                                                    Đang nợ
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2 text-center">
                                            <div className="flex flex-wrap justify-center gap-1">
                                                <button className="btn-primary text-xs" onClick={() => openPay(c)}>
                                                    Thu nợ
                                                </button>
                                                <button className="btn-light text-xs" onClick={() => openHistory(c)}>
                                                    Lịch sử
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ═══ PAYMENT MODAL ═══ */}
            {payModal && payCustomer && (
                <Modal open={payModal} title={`Thu nợ - ${payCustomer.name}`} onClose={() => setPayModal(false)}>
                    <div className="space-y-3">
                        <div className="rounded-lg bg-brand-50 p-3">
                            <p className="text-sm text-brand-700">
                                Nợ hiện tại: <span className="font-bold text-red-600">{money(payCustomer.currentDebt)} đ</span>
                            </p>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-brand-700">Số tiền trả</label>
                            <input
                                className="input w-full"
                                type="number"
                                placeholder="Nhập số tiền..."
                                value={payAmount}
                                onChange={(e) => setPayAmount(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-brand-700">Ghi chú</label>
                            <input
                                className="input w-full"
                                placeholder="Ghi chú (tùy chọn)"
                                value={payNote}
                                onChange={(e) => setPayNote(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button className="btn-light" onClick={() => setPayModal(false)}>
                                Hủy
                            </button>
                            <button
                                className="btn-primary"
                                disabled={!payAmount || Number(payAmount) <= 0}
                                onClick={submitPay}
                            >
                                Xác nhận thu nợ
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ═══ ADJUST MODAL ═══ */}
            {adjModal && adjCustomer && (
                <Modal open={adjModal} title={`Điều chỉnh nợ - ${adjCustomer.name}`} onClose={() => setAdjModal(false)}>
                    <div className="space-y-3">
                        <div className="rounded-lg bg-brand-50 p-3">
                            <p className="text-sm text-brand-700">
                                Nợ hiện tại: <span className="font-bold text-red-600">{money(adjCustomer.currentDebt)} đ</span>
                            </p>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-brand-700">Loại điều chỉnh</label>
                            <select
                                className="input w-full"
                                value={adjType}
                                onChange={(e) => setAdjType(e.target.value as "ADJUST_UP" | "ADJUST_DOWN")}
                            >
                                <option value="ADJUST_DOWN">Giảm nợ</option>
                                <option value="ADJUST_UP">Tăng nợ</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-brand-700">Số tiền</label>
                            <input
                                className="input w-full"
                                type="number"
                                placeholder="Nhập số tiền..."
                                value={adjAmount}
                                onChange={(e) => setAdjAmount(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-brand-700">Lý do *</label>
                            <input
                                className="input w-full"
                                placeholder="Nhập lý do điều chỉnh..."
                                value={adjNote}
                                onChange={(e) => setAdjNote(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button className="btn-light" onClick={() => setAdjModal(false)}>
                                Hủy
                            </button>
                            <button
                                className="btn-primary"
                                disabled={!adjAmount || Number(adjAmount) <= 0 || !adjNote.trim()}
                                onClick={submitAdj}
                            >
                                Xác nhận điều chỉnh
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ═══ DEBT LIMIT MODAL ═══ */}
            {limitModal && limitCustomer && (
                <Modal open={limitModal} title={`Hạn mức nợ - ${limitCustomer.name}`} onClose={() => setLimitModal(false)}>
                    <div className="space-y-3">
                        <div className="rounded-lg bg-brand-50 p-3">
                            <p className="text-sm text-brand-700">
                                Nợ hiện tại: <span className="font-bold text-red-600">{money(limitCustomer.currentDebt)} đ</span>
                            </p>
                            <p className="text-sm text-brand-700">
                                Hạn mức hiện tại:{" "}
                                <span className="font-bold text-brand-800">
                                    {limitCustomer.debtLimit > 0 ? `${money(limitCustomer.debtLimit)} đ` : "Không giới hạn"}
                                </span>
                            </p>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-brand-700">
                                Hạn mức nợ mới (0 = không giới hạn)
                            </label>
                            <input
                                className="input w-full"
                                type="number"
                                placeholder="Nhập hạn mức..."
                                value={limitValue}
                                onChange={(e) => setLimitValue(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button className="btn-light" onClick={() => setLimitModal(false)}>
                                Hủy
                            </button>
                            <button className="btn-primary" onClick={submitLimit}>
                                Cập nhật
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ═══ HISTORY SECTION (INLINE) ═══ */}
            {historyCustomer && (
                <div id="history-section" className="card p-4 mt-4">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-bold text-brand-800">📋 Chi tiết công nợ - {historyCustomer.name}</h3>
                        <button className="btn-light text-sm" onClick={() => setHistoryCustomer(null)}>Đóng</button>
                    </div>
                    <div className="space-y-3">
                        <div className="rounded-lg bg-brand-50 p-3 flex justify-between">
                            <p className="text-sm text-brand-700">
                                SĐT: <span className="font-semibold text-brand-800">{historyCustomer.phone || "—"}</span>
                            </p>
                            <p className="text-sm text-brand-700">
                                Nợ hiện tại: <span className="font-bold text-red-600">{money(historyCustomer.currentDebt)} đ</span>
                            </p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-brand-200 text-left bg-brand-50/50">
                                        <th className="py-2 px-2">Thời gian</th>
                                        <th className="py-2 px-2">Loại</th>
                                        <th className="py-2 px-2 text-right">Số tiền</th>
                                        <th className="py-2 px-2 text-right">Dư nợ sau GD</th>
                                        <th className="py-2 px-2">Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyRows.map((tx) => (
                                        <tr key={tx.id} className="border-b border-brand-100 hover:bg-brand-50/50 transition-colors">
                                            <td className="py-2 px-2 text-xs">{new Date(tx.createdAt).toLocaleString("vi-VN")}</td>
                                            <td className={`py-2 px-2 text-xs font-semibold ${debtTypeColor[tx.type] || ""}`}>
                                                {debtTypeLabel[tx.type] || tx.type}
                                            </td>
                                            <td className={`py-2 px-2 text-right font-semibold ${tx.type === "PAYMENT" || tx.type === "ADJUST_DOWN" ? "text-green-600" : "text-red-600"}`}>
                                                {tx.type === "PAYMENT" || tx.type === "ADJUST_DOWN" ? "-" : "+"}
                                                {money(tx.amount)} đ
                                            </td>
                                            <td className="py-2 px-2 text-right font-bold">{money(tx.balanceAfter)} đ</td>
                                            <td className="py-2 px-2 text-xs text-brand-600">
                                                {tx.invoice ? (
                                                    <a
                                                        href={`/receipt/${tx.invoice.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="font-semibold text-blue-600 hover:underline"
                                                    >
                                                        HD: {tx.invoice.code}
                                                    </a>
                                                ) : null}{" "}
                                                {tx.note || ""}
                                            </td>
                                        </tr>
                                    ))}
                                    {historyRows.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-4 text-center text-brand-400">
                                                Chưa có giao dịch nợ nào
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {historyTotalPages > 1 && (
                            <div className="flex items-center justify-end gap-2 mt-4 border-t border-brand-100 pt-3">
                                <button
                                    className="btn-light"
                                    disabled={historyPage <= 1}
                                    onClick={() => loadHistory(historyCustomer.id, historyPage - 1)}
                                >
                                    Trước
                                </button>
                                <span className="text-sm font-medium text-brand-700">
                                    Trang {historyPage}/{historyTotalPages}
                                </span>
                                <button
                                    className="btn-light"
                                    disabled={historyPage >= historyTotalPages}
                                    onClick={() => loadHistory(historyCustomer.id, historyPage + 1)}
                                >
                                    Tiếp
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
