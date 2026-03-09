import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api/client";
import type { AuditLog, PaginatedResponse, RestockSuggestion } from "../../types";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const toCsvCell = (value: string | number) => {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
};

const downloadCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
  const content = [headers, ...rows].map((row) => row.map(toCsvCell).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const buildQuery = (period: "day" | "week" | "month", dateFrom: string, dateTo: string) => {
  const params = new URLSearchParams({ period });
  if (dateFrom) {
    params.set("dateFrom", dateFrom);
  }
  if (dateTo) {
    params.set("dateTo", dateTo);
  }
  return params.toString();
};

export const ReportsPage = () => {
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [summary, setSummary] = useState<any>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [profitRows, setProfitRows] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [restockRows, setRestockRows] = useState<RestockSuggestion[]>([]);
  const [auditRows, setAuditRows] = useState<AuditLog[]>([]);
  const [auditEntity, setAuditEntity] = useState("");
  const [auditAction, setAuditAction] = useState("");
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [shiftFrom, setShiftFrom] = useState("");
  const [shiftTo, setShiftTo] = useState("");
  const [shiftUserId, setShiftUserId] = useState("");
  const [shiftNote, setShiftNote] = useState("");
  const [shiftSummary, setShiftSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Chart state
  type ChartTab = "day" | "month" | "year";
  const [chartTab, setChartTab] = useState<ChartTab>("day");
  const [chartMonth, setChartMonth] = useState<any[]>([]);
  const [chartYear, setChartYear] = useState<any[]>([]);

  // Chart date range filters
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const currentDay = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const startOfMonth = `${currentYear}-${currentMonth}-01`;

  const [chartDateFrom, setChartDateFrom] = useState(startOfMonth);
  const [chartDateTo, setChartDateTo] = useState(currentDay);
  const [chartMonthFrom, setChartMonthFrom] = useState(`${currentYear}-01`);
  const [chartMonthTo, setChartMonthTo] = useState(`${currentYear}-12`);

  // Day tab uses its own filtered profitRows (chartDayData), month/year use chartMonth/chartYear
  const [chartDayData, setChartDayData] = useState<any[]>([]);
  const chartData = chartTab === "day" ? chartDayData : chartTab === "month" ? chartMonth : chartYear;
  const chartTabLabel: Record<ChartTab, string> = { day: "Theo ngày", month: "Theo tháng", year: "Theo năm" };

  const loadAuditLogs = async (nextPage = auditPage) => {
    const params = new URLSearchParams({
      page: String(nextPage),
      pageSize: "15",
    });
    if (auditEntity.trim()) {
      params.set("entity", auditEntity.trim());
    }
    if (auditAction.trim()) {
      params.set("action", auditAction.trim());
    }

    const auditRes = await apiRequest<PaginatedResponse<AuditLog>>(`/reports/audit-logs?${params.toString()}`);
    setAuditRows(auditRes.items);
    setAuditPage(auditRes.page);
    setAuditTotalPages(auditRes.totalPages);
  };

  const loadData = async () => {
    const query = buildQuery(period, dateFrom, dateTo);
    const [summaryRes, topRes, profitRes, lowRes, restockRes] = await Promise.all([
      apiRequest(`/reports/summary?${query}`),
      apiRequest<any[]>(`/reports/top-products?limit=10&${query}`),
      apiRequest<any[]>(`/reports/profit?${query}`),
      apiRequest<any[]>("/reports/low-stock?limit=100"),
      apiRequest<RestockSuggestion[]>("/reports/restock-suggestions?limit=100"),
    ]);
    setSummary(summaryRes);
    setTopProducts(topRes);
    setProfitRows(profitRes);
    setLowStock(lowRes);
    setRestockRows(restockRes);
  };

  const loadChartDayData = async (from: string, to: string) => {
    try {
      const params = new URLSearchParams({ period: "day" });
      if (from) params.set("dateFrom", from);
      if (to) params.set("dateTo", to);
      const res = await apiRequest<any[]>(`/reports/profit?${params.toString()}`);
      setChartDayData(res);
    } catch (err) {
      console.error("Failed to load day chart:", err);
      setChartDayData([]);
    }
  };

  const loadChartMonthData = async (from: string, to: string) => {
    try {
      const monthParams = new URLSearchParams();
      // Convert YYYY-MM to full dates for the API
      if (from) monthParams.set("dateFrom", `${from}-01`);
      if (to) {
        // Set to last day of the "to" month
        const [y, m] = to.split("-").map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        monthParams.set("dateTo", `${to}-${String(lastDay).padStart(2, "0")}`);
      }
      const monthRes = await apiRequest<any[]>(`/reports/profit-by-month?${monthParams.toString()}`);
      setChartMonth(monthRes);
    } catch (err) {
      console.error("Failed to load month chart:", err);
      setChartMonth([]);
    }
  };

  const loadChartYearData = async () => {
    try {
      const yearRes = await apiRequest<any[]>(`/reports/profit-by-year`);
      setChartYear(yearRes);
    } catch (err) {
      console.error("Failed to load year chart:", err);
      setChartYear([]);
    }
  };

  const loadAllChartData = async () => {
    await Promise.all([
      loadChartDayData(chartDateFrom, chartDateTo),
      loadChartMonthData(chartMonthFrom, chartMonthTo),
      loadChartYearData(),
    ]);
  };

  const loadShiftSummary = async () => {
    if (!shiftFrom || !shiftTo) {
      setError("Cần nhập dateFrom/dateTo cho chốt ca");
      return;
    }

    const params = new URLSearchParams({
      dateFrom: shiftFrom,
      dateTo: shiftTo,
    });
    if (shiftUserId.trim()) {
      params.set("userId", shiftUserId.trim());
    }

    const data = await apiRequest(`/reports/shift-summary?${params.toString()}`);
    setShiftSummary(data);
  };

  const closeShift = async () => {
    if (!shiftFrom || !shiftTo) {
      setError("Cần nhập dateFrom/dateTo trước khi chốt ca");
      return;
    }

    const data = await apiRequest(`/reports/shift-close`, {
      method: "POST",
      body: JSON.stringify({
        userId: shiftUserId ? Number(shiftUserId) : undefined,
        dateFrom: shiftFrom,
        dateTo: shiftTo,
        note: shiftNote,
      }),
    });

    setShiftSummary(data);
    setShiftNote("");
    setError("Chốt ca thành công");
    await loadAuditLogs(1);
  };

  useEffect(() => {
    Promise.all([loadData(), loadAllChartData(), loadAuditLogs(1)]).catch((err) =>
      setError(err instanceof Error ? err.message : "Tải báo cáo thất bại")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const summaryTitle = useMemo(() => {
    if (period === "day") return "ngày";
    if (period === "week") return "tuần";
    return "tháng";
  }, [period]);

  const runFilter = () => {
    Promise.all([loadData(), loadAllChartData(), loadAuditLogs(1)]).catch((err) =>
      setError(err instanceof Error ? err.message : "Tải báo cáo thất bại")
    );
  };

  const money = (v: number) => v.toLocaleString("vi-VN");

  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-brand-100 bg-white p-3 shadow-lg">
        <p className="mb-1.5 text-xs font-bold text-brand-800">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} className="flex items-center gap-2 text-xs" style={{ color: entry.color }}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: entry.color }} />
            {entry.name}: <span className="font-bold">{money(entry.value)} đ</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-brand-800">Báo cáo doanh thu và lợi nhuận</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <select className="input w-40" value={period} onChange={(e) => setPeriod(e.target.value as "day" | "week" | "month")}>
              <option value="day">Ngày</option>
              <option value="week">Tuần</option>
              <option value="month">Tháng</option>
            </select>
            <button className="btn-light" onClick={runFilter}>
              Áp dụng
            </button>
            <button
              className="btn-light"
              onClick={() =>
                downloadCsv(
                  "bao-cao-loi-nhuan-theo-ngay.csv",
                  ["Ngày", "Doanh thu", "Giá vốn", "Lợi nhuận"],
                  profitRows.map((row) => [row.date, row.revenue, row.cost, row.profit])
                )
              }
            >
              Xuất CSV lợi nhuận
            </button>
          </div>
        </div>

        {summary ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <div className="rounded-lg bg-brand-50 p-3">
              <p className="text-sm text-brand-700">Doanh thu ({summaryTitle})</p>
              <p className="text-xl font-black text-brand-800">{summary.revenue.toLocaleString("vi-VN")} đ</p>
            </div>
            <div className="rounded-lg bg-brand-50 p-3">
              <p className="text-sm text-brand-700">Giá vốn ước tính</p>
              <p className="text-xl font-black text-brand-800">{summary.estimatedCost.toLocaleString("vi-VN")} đ</p>
            </div>
            <div className="rounded-lg bg-brand-50 p-3">
              <p className="text-sm text-brand-700">Lợi nhuận ước tính</p>
              <p className="text-xl font-black text-brand-800">{summary.estimatedProfit.toLocaleString("vi-VN")} đ</p>
            </div>
            <div className="rounded-lg bg-brand-50 p-3">
              <p className="text-sm text-brand-700">Số hóa đơn</p>
              <p className="text-xl font-black text-brand-800">{summary.invoices}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-brand-800">Top sản phẩm bán chạy</h3>
            <button
              className="btn-light"
              onClick={() =>
                downloadCsv(
                  "top-san-pham-ban-chay.csv",
                  ["Sản phẩm", "Số lượng", "Doanh thu"],
                  topProducts.map((row) => [row.product?.name ?? "", row.qty, row.revenue])
                )
              }
            >
              Xuất CSV top bán chạy
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-200 text-left">
                <th className="py-2">Sản phẩm</th>
                <th className="py-2 text-right">SL</th>
                <th className="py-2 text-right">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((row, idx) => (
                <tr key={idx} className="border-b border-brand-100">
                  <td className="py-2">{row.product?.name}</td>
                  <td className="py-2 text-right">{row.qty}</td>
                  <td className="py-2 text-right">{row.revenue.toLocaleString("vi-VN")} đ</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-4">
          <h3 className="mb-2 text-lg font-bold text-brand-800">Cảnh báo tồn thấp</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-200 text-left">
                <th className="py-2">Sản phẩm</th>
                <th className="py-2 text-right">Tồn</th>
                <th className="py-2 text-right">Min</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((row, idx) => (
                <tr key={idx} className="border-b border-brand-100">
                  <td className="py-2">{row.product?.name}</td>
                  <td className="py-2 text-right text-red-600">{row.stockQty}</td>
                  <td className="py-2 text-right">{row.product?.minStock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="mb-2 text-lg font-bold text-brand-800">Gợi ý nhập hàng</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-200 text-left">
              <th className="py-2">Sản phẩm</th>
              <th className="py-2 text-right">Tồn hiện tại</th>
              <th className="py-2 text-right">Số lượng đề xuất</th>
              <th className="py-2 text-right">Chi phí dự kiến</th>
            </tr>
          </thead>
          <tbody>
            {restockRows.map((row) => (
              <tr key={row.product.id} className="border-b border-brand-100">
                <td className="py-2">{row.product.name}</td>
                <td className="py-2 text-right">{row.stockQty}</td>
                <td className="py-2 text-right">{row.suggestedQty}</td>
                <td className="py-2 text-right">{row.estimatedCost.toLocaleString("vi-VN")} đ</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══ CHART SECTION ═══ */}
      <div className="card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-brand-800">📊 Biểu đồ doanh thu & lợi nhuận</h3>
          <div className="flex rounded-lg border border-brand-200 p-0.5">
            {(["day", "month", "year"] as ChartTab[]).map((tab) => (
              <button
                key={tab}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${chartTab === tab
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-brand-600 hover:bg-brand-50"
                  }`}
                onClick={() => setChartTab(tab)}
              >
                {chartTabLabel[tab]}
              </button>
            ))}
          </div>
        </div>

        {/* Date range filters for chart */}
        {chartTab === "day" && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-brand-600">Từ ngày:</span>
            <input
              className="input"
              type="date"
              value={chartDateFrom}
              onChange={(e) => setChartDateFrom(e.target.value)}
            />
            <span className="text-sm font-medium text-brand-600">Đến ngày:</span>
            <input
              className="input"
              type="date"
              value={chartDateTo}
              onChange={(e) => setChartDateTo(e.target.value)}
            />
            <button
              className="btn-light"
              onClick={() => loadChartDayData(chartDateFrom, chartDateTo)}
            >
              Xem
            </button>
          </div>
        )}
        {chartTab === "month" && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-brand-600">Từ tháng:</span>
            <input
              className="input"
              type="month"
              value={chartMonthFrom}
              onChange={(e) => setChartMonthFrom(e.target.value)}
            />
            <span className="text-sm font-medium text-brand-600">Đến tháng:</span>
            <input
              className="input"
              type="month"
              value={chartMonthTo}
              onChange={(e) => setChartMonthTo(e.target.value)}
            />
            <button
              className="btn-light"
              onClick={() => loadChartMonthData(chartMonthFrom, chartMonthTo)}
            >
              Xem
            </button>
          </div>
        )}

        {chartData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4A90E2" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#4A90E2" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0EAF5" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#5A7184" }}
                  tickLine={false}
                  axisLine={{ stroke: "#E0EAF5" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#5A7184" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : v}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                <Bar dataKey="revenue" name="Doanh thu" fill="url(#gradRevenue)" radius={[4, 4, 0, 0]} barSize={chartTab === "year" ? 60 : undefined} />
                <Bar dataKey="cost" name="Giá vốn" fill="url(#gradCost)" radius={[4, 4, 0, 0]} barSize={chartTab === "year" ? 60 : undefined} />
                <Line
                  dataKey="profit"
                  name="Lợi nhuận"
                  type="monotone"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#10B981", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6, fill: "#10B981", stroke: "#fff", strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center text-brand-400">
            <p>Chưa có dữ liệu để hiển thị biểu đồ</p>
          </div>
        )}
      </div>

      {/* ═══ PROFIT TABLE (detail) ═══ */}
      <div className="card p-4">
        <h3 className="mb-2 text-lg font-bold text-brand-800">Lợi nhuận chi tiết theo ngày</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-200 text-left">
              <th className="py-2">Ngày</th>
              <th className="py-2 text-right">Doanh thu</th>
              <th className="py-2 text-right">Giá vốn</th>
              <th className="py-2 text-right">Lợi nhuận</th>
            </tr>
          </thead>
          <tbody>
            {profitRows.map((row, idx) => (
              <tr key={idx} className="border-b border-brand-100">
                <td className="py-2">{row.date}</td>
                <td className="py-2 text-right">{row.revenue.toLocaleString("vi-VN")} đ</td>
                <td className="py-2 text-right">{row.cost.toLocaleString("vi-VN")} đ</td>
                <td className="py-2 text-right font-semibold">{row.profit.toLocaleString("vi-VN")} đ</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-brand-800">Audit log</h3>
          <div className="flex gap-2">
            <input className="input" placeholder="Entity" value={auditEntity} onChange={(e) => setAuditEntity(e.target.value)} />
            <input className="input" placeholder="Action" value={auditAction} onChange={(e) => setAuditAction(e.target.value)} />
            <button className="btn-light" onClick={() => loadAuditLogs(1)}>
              Tìm
            </button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-200 text-left">
              <th className="py-2">Thời gian</th>
              <th className="py-2">Entity</th>
              <th className="py-2">Action</th>
              <th className="py-2">Người tạo</th>
            </tr>
          </thead>
          <tbody>
            {auditRows.map((row) => (
              <tr key={row.id} className="border-b border-brand-100">
                <td className="py-2">{new Date(row.createdAt).toLocaleString("vi-VN")}</td>
                <td className="py-2">
                  {row.entity}#{row.entityId}
                </td>
                <td className="py-2">{row.action}</td>
                <td className="py-2">{row.createdBy?.email ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button className="btn-light" disabled={auditPage <= 1} onClick={() => loadAuditLogs(auditPage - 1)}>
            Trước
          </button>
          <span className="text-sm text-brand-700">
            Trang {auditPage}/{auditTotalPages}
          </span>
          <button className="btn-light" disabled={auditPage >= auditTotalPages} onClick={() => loadAuditLogs(auditPage + 1)}>
            Tiếp
          </button>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="mb-2 text-lg font-bold text-brand-800">Chốt ca</h3>
        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          <input className="input" type="date" value={shiftFrom} onChange={(e) => setShiftFrom(e.target.value)} />
          <input className="input" type="date" value={shiftTo} onChange={(e) => setShiftTo(e.target.value)} />
          <input
            className="input"
            placeholder="User ID (tùy chọn)"
            value={shiftUserId}
            onChange={(e) => setShiftUserId(e.target.value)}
          />
          <input className="input" placeholder="Ghi chú chốt ca" value={shiftNote} onChange={(e) => setShiftNote(e.target.value)} />
        </div>
        <div className="mb-3 flex gap-2">
          <button className="btn-light" onClick={() => loadShiftSummary().catch(() => undefined)}>
            Xem tổng hợp
          </button>
          <button className="btn-primary" onClick={() => closeShift().catch(() => undefined)}>
            Chốt ca
          </button>
        </div>

        {shiftSummary ? (
          <div className="rounded-lg bg-brand-50 p-3 text-sm">
            <p>Hóa đơn hoàn tất: {shiftSummary.invoiceCount}</p>
            <p>Hóa đơn hủy: {shiftSummary.voidCount}</p>
            <p>Doanh thu: {Number(shiftSummary.revenue || 0).toLocaleString("vi-VN")} đ</p>
            <p>Tiền mặt: {Number(shiftSummary.paymentByMethod?.CASH || 0).toLocaleString("vi-VN")} đ</p>
            <p>Chuyển khoản: {Number(shiftSummary.paymentByMethod?.BANK || 0).toLocaleString("vi-VN")} đ</p>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
};
