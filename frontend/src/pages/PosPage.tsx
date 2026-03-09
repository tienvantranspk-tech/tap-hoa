import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { BarcodeScanner } from "../components/BarcodeScanner";
import { Modal } from "../components/Modal";
import type { Customer, PaginatedResponse, Product, SalesInvoice, Warehouse } from "../types";

const money = (value: number) => value.toLocaleString("vi-VN");

const isPromoActive = (product: Product): boolean => {
  if (product.promoPrice == null) return false;
  const now = new Date();
  const start = product.promoStartAt ? new Date(product.promoStartAt) : null;
  const end = product.promoEndAt ? new Date(product.promoEndAt) : null;
  if (end && end < now) return false;
  if (start && start > now) return false;
  return true;
};

const getEffectivePrice = (product: Product): number => {
  if (isPromoActive(product)) return product.promoPrice!;
  return product.customPrice ?? product.priceTier?.price ?? 0;
};

type CartRow = {
  product: Product;
  qty: number;
};

type InvoiceFilter = "ALL" | "COMPLETED" | "VOID";

const statusLabel = (status: "COMPLETED" | "VOID") => (status === "COMPLETED" ? "Hoàn tất" : "Đã hủy");

export const PosPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [warehouseStockMap, setWarehouseStockMap] = useState<Map<number, number>>(new Map());

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartRow[]>([]);
  const [customerId, setCustomerId] = useState<number>(1);
  const [warehouseId, setWarehouseId] = useState<number>(1);
  const [discountType, setDiscountType] = useState<"percent" | "amount">("amount");
  const [discountValue, setDiscountValue] = useState(0);
  const [paymentMode, setPaymentMode] = useState<"CASH" | "BANK" | "MIXED" | "DEBT">("CASH");
  const [cashAmount, setCashAmount] = useState(0);
  const [bankAmount, setBankAmount] = useState(0);

  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>("ALL");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceTotalPages, setInvoiceTotalPages] = useState(1);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const canVoidInvoice = user?.role === "ADMIN" || user?.role === "MANAGER";
  const canReturnInvoice = user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "CASHIER";

  const loadWarehouseStock = async (whId: number) => {
    try {
      const stockItems = await apiRequest<Array<{ product: Product; qty: number }>>(`/warehouses/${whId}/stock`);
      const map = new Map<number, number>();
      for (const item of stockItems) {
        if (item.product) {
          map.set(item.product.id, item.qty);
        }
      }
      setWarehouseStockMap(map);
    } catch {
      setWarehouseStockMap(new Map());
    }
  };

  const loadBaseData = async () => {
    const [productRes, customerRes, warehouseRes] = await Promise.all([
      apiRequest<PaginatedResponse<Product>>("/products?page=1&pageSize=300&active=true"),
      apiRequest<Customer[]>("/settings/customers"),
      apiRequest<Warehouse[]>("/warehouses"),
    ]);

    setProducts(productRes.items);
    setCustomers(customerRes);
    setWarehouses(warehouseRes);

    if (customerRes.length > 0) {
      setCustomerId((prev) => (customerRes.some((item) => item.id === prev) ? prev : customerRes[0].id));
    }

    // Compute target warehouse ID directly — don't rely on setState callback
    let targetWhId = warehouseId;
    if (warehouseRes.length > 0) {
      const exists = warehouseRes.some((item) => item.id === targetWhId);
      if (!exists) {
        targetWhId = warehouseRes[0].id;
      }
    }
    setWarehouseId(targetWhId);

    // Load stock with the correctly resolved warehouse ID
    await loadWarehouseStock(targetWhId);
  };

  const loadInvoices = async (page = invoicePage, filter = invoiceFilter, searchKeyword = invoiceSearch) => {
    setInvoiceLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });

      if (filter !== "ALL") {
        params.set("status", filter);
      }
      if (searchKeyword.trim()) {
        params.set("search", searchKeyword.trim());
      }

      const data = await apiRequest<PaginatedResponse<SalesInvoice>>(`/sales/invoices?${params.toString()}`);
      setInvoices(data.items);
      setInvoicePage(data.page);
      setInvoiceTotalPages(data.totalPages);
    } finally {
      setInvoiceLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      await Promise.all([loadBaseData(), loadInvoices(1, "ALL", "")]);
    };

    run().catch((err) => setError(err instanceof Error ? err.message : "Tải dữ liệu thất bại"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadInvoices(1, invoiceFilter, invoiceSearch).catch((err) =>
      setError(err instanceof Error ? err.message : "Tải hóa đơn thất bại")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceFilter]);


  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return products
      .filter((item) => item.active)
      .filter((item) => {
        if (!keyword) {
          return true;
        }
        return (
          item.name.toLowerCase().includes(keyword) ||
          item.sku.toLowerCase().includes(keyword) ||
          item.barcode.toLowerCase().includes(keyword)
        );
      })
      .slice(0, 40);
  }, [products, search]);

  const getWarehouseStock = (productId: number) => warehouseStockMap.get(productId) ?? 0;

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty * getEffectivePrice(item.product), 0),
    [cart]
  );

  const discount = useMemo(() => {
    return discountType === "percent" ? Math.round((subtotal * discountValue) / 100) : Math.round(discountValue);
  }, [discountType, discountValue, subtotal]);

  const total = Math.max(0, subtotal - discount);

  useEffect(() => {
    if (paymentMode === "CASH") {
      setCashAmount(total);
      setBankAmount(0);
    } else if (paymentMode === "BANK") {
      setCashAmount(0);
      setBankAmount(total);
    } else if (paymentMode === "DEBT") {
      setCashAmount(0);
      setBankAmount(0);
    }
  }, [paymentMode, total]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.product.id === product.id);
      if (idx === -1) {
        return [...prev, { product, qty: 1 }];
      }
      const clone = [...prev];
      clone[idx] = { ...clone[idx], qty: clone[idx].qty + 1 };
      return clone;
    });
  };

  const handleBarcodeScan = (code: string) => {
    setScannerOpen(false);
    const found = products.find(
      (p) => p.barcode === code || p.sku === code
    );
    if (!found) {
      setError(`Không tìm thấy sản phẩm với mã: ${code}`);
      return;
    }
    const stock = getWarehouseStock(found.id);
    if (stock <= 0) {
      setError(`${found.name} đã hết hàng trong kho`);
      return;
    }
    addToCart(found);
    setError(null);
  };

  const updateQty = (productId: number, qty: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.product.id === productId ? { ...item, qty: Math.max(1, qty) } : item))
        .filter((item) => item.qty > 0)
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const completeSale = async () => {
    if (!cart.length) {
      setError("Giỏ hàng đang rống");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const roundedCash = Math.round(cashAmount);
      const roundedBank = Math.round(bankAmount);
      const mixedTotal = roundedCash + roundedBank;

      if (paymentMode === "MIXED" && mixedTotal !== total) {
        setError("Tổng tiền mặt + chuyển khoản phải bằng tổng thanh toán");
        setLoading(false);
        return;
      }

      const payments =
        paymentMode === "MIXED"
          ? [
            ...(roundedCash > 0 ? [{ method: "CASH", amount: roundedCash }] : []),
            ...(roundedBank > 0 ? [{ method: "BANK", amount: roundedBank }] : []),
          ]
          : [{ method: paymentMode, amount: total }];

      const invoice = await apiRequest<SalesInvoice>("/sales/invoices", {
        method: "POST",
        body: JSON.stringify({
          customerId,
          warehouseId,
          discountType,
          discountValue,
          items: cart.map((item) => ({
            productId: item.product.id,
            qty: item.qty,
          })),
          payments,
        }),
      });

      setCart([]);
      setDiscountValue(0);
      await Promise.all([loadBaseData(), loadInvoices(invoicePage, invoiceFilter, invoiceSearch)]);
      navigate(`/receipt/${invoice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo hóa đơn thất bại");
    } finally {
      setLoading(false);
    }
  };

  const voidInvoice = async (invoiceId: number) => {
    const reason = window.prompt("Nhập lý do hủy hóa đơn:", "Khách đổi ý");
    if (!reason) {
      return;
    }

    try {
      await apiRequest(`/sales/invoices/${invoiceId}/void`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      await Promise.all([loadBaseData(), loadInvoices(invoicePage, invoiceFilter, invoiceSearch)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hủy hóa đơn thất bại");
    }
  };

  const returnInvoice = async (invoiceId: number) => {
    const rawItems = window.prompt("Nhập danh sách trả hàng theo dạng productId:qty, vd 1:2,3:1", "");
    if (!rawItems) {
      return;
    }

    const reason = window.prompt("Lý do trả hàng", "Khách trả hàng") || "Khách trả hàng";

    const items = rawItems
      .split(",")
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const [productIdRaw, qtyRaw] = chunk.split(":").map((part) => part.trim());
        return {
          productId: Number(productIdRaw),
          qty: Number(qtyRaw),
        };
      })
      .filter((item) => Number.isFinite(item.productId) && Number.isFinite(item.qty) && item.qty > 0);

    if (!items.length) {
      setError("Định dạng trả hàng không hợp lệ");
      return;
    }

    try {
      const result = await apiRequest<{ refundAmount: number }>(`/sales/invoices/${invoiceId}/return`, {
        method: "POST",
        body: JSON.stringify({
          reason,
          items,
        }),
      });

      setError(`Trả hàng thành công. Số tiền hoàn: ${money(result.refundAmount)} đ`);
      await Promise.all([loadBaseData(), loadInvoices(invoicePage, invoiceFilter, invoiceSearch)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trả hàng thất bại");
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <section className="card p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-brand-800">POS bán hàng nhanh</h2>
              <div className="flex w-full max-w-sm gap-2">
                <input
                  className="input flex-1"
                  placeholder="Quét mã vạch / tìm theo tên"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button
                  className="btn-light shrink-0 text-lg"
                  onClick={() => setScannerOpen(true)}
                  title="Quét mã vạch bằng camera"
                >
                  📷
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product) => {
                const stock = getWarehouseStock(product.id);
                const outOfStock = stock <= 0;
                const hasPromo = isPromoActive(product);
                const effectivePrice = getEffectivePrice(product);
                return (
                  <button
                    key={product.id}
                    className={`relative rounded-xl border p-3 text-left transition-all duration-200 ${outOfStock
                      ? "cursor-not-allowed border-brand-100 bg-brand-50/50 opacity-50"
                      : hasPromo
                        ? "border-emerald-200 bg-emerald-50/30 hover:border-emerald-400 hover:shadow-md hover:shadow-emerald-100"
                        : "border-brand-100 bg-white hover:border-brand-300 hover:shadow-md"
                      }`}
                    onClick={() => !outOfStock && addToCart(product)}
                    disabled={outOfStock}
                  >
                    {hasPromo && !outOfStock && (
                      <span className="absolute -right-1 -top-1 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm" style={{ animation: "pulse 2s infinite" }}>
                        🔥 KM
                      </span>
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-semibold ${outOfStock ? "text-brand-700/40" : "text-brand-800"}`}>
                        {product.name}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${outOfStock
                          ? "bg-red-50 text-red-500"
                          : stock <= 5
                            ? "bg-amber-50 text-amber-600"
                            : "bg-accent-50 text-accent-500"
                          }`}
                      >
                        {outOfStock ? "Hết hàng" : `Kho: ${stock}`}
                      </span>
                    </div>
                    <p className={`text-xs ${outOfStock ? "text-brand-700/30" : "text-brand-700/60"}`}>
                      {product.sku} / {product.barcode}
                    </p>
                    <div className="mt-2 flex items-baseline gap-2">
                      {hasPromo ? (
                        <>
                          <p className={`text-base font-bold ${outOfStock ? "text-brand-700/30" : "text-emerald-600"}`}>
                            {money(effectivePrice)} đ
                          </p>
                          <p className={`text-xs line-through ${outOfStock ? "text-brand-700/20" : "text-brand-400"}`}>
                            {money(product.customPrice ?? product.priceTier?.price ?? 0)} đ
                          </p>
                        </>
                      ) : (
                        <p className={`text-base font-bold ${outOfStock ? "text-brand-700/30" : "text-brand-500"}`}>
                          {money(effectivePrice)} đ
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-brand-800">Hóa đơn gần đây</h3>
              <div className="flex gap-2">
                <input
                  className="input w-52"
                  placeholder="Tìm mã HĐ / khách"
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                />
                <button className="btn-light" onClick={() => loadInvoices(1, invoiceFilter, invoiceSearch)}>
                  Tìm
                </button>
                <select
                  className="input w-44"
                  value={invoiceFilter}
                  onChange={(e) => setInvoiceFilter(e.target.value as InvoiceFilter)}
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="COMPLETED">Hoàn tất</option>
                  <option value="VOID">Đã hủy</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-200 text-left">
                    <th className="py-2">Mã</th>
                    <th className="py-2">Khách</th>
                    <th className="py-2 text-right">Tổng</th>
                    <th className="py-2">Trạng thái</th>
                    <th className="py-2">Thời gian</th>
                    <th className="py-2 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-brand-100">
                      <td className="py-2 font-semibold text-brand-700">{invoice.code}</td>
                      <td className="py-2">{invoice.customer?.name ?? "Khách lẻ"}</td>
                      <td className="py-2 text-right">{money(invoice.total)} đ</td>
                      <td className="py-2">{statusLabel(invoice.status)}</td>
                      <td className="py-2">{new Date(invoice.createdAt).toLocaleString("vi-VN")}</td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <button className="btn-light" onClick={() => navigate(`/receipt/${invoice.id}`)}>
                            In lại
                          </button>
                          {canReturnInvoice && invoice.status === "COMPLETED" ? (
                            <button className="btn-light" onClick={() => returnInvoice(invoice.id)}>
                              Trả hàng
                            </button>
                          ) : null}
                          {canVoidInvoice && invoice.status === "COMPLETED" ? (
                            <button className="btn-light" onClick={() => voidInvoice(invoice.id)}>
                              Hủy
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {invoiceLoading ? <p className="mt-2 text-sm text-brand-700">Đang tải hóa đơn...</p> : null}
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  className="btn-light"
                  disabled={invoicePage <= 1}
                  onClick={() => loadInvoices(invoicePage - 1, invoiceFilter, invoiceSearch)}
                >
                  Trước
                </button>
                <span className="text-sm text-brand-700">
                  Trang {invoicePage}/{invoiceTotalPages}
                </span>
                <button
                  className="btn-light"
                  disabled={invoicePage >= invoiceTotalPages}
                  onClick={() => loadInvoices(invoicePage + 1, invoiceFilter, invoiceSearch)}
                >
                  Tiếp
                </button>
              </div>
            </div>
          </section>
        </div>

        <aside className="card p-4">
          <h3 className="mb-3 text-lg font-bold text-brand-800">Giỏ hàng</h3>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <select className="input" value={warehouseId} onChange={(e) => { const id = Number(e.target.value); setWarehouseId(id); loadWarehouseStock(id); }}>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            <select className="input" value={customerId} onChange={(e) => setCustomerId(Number(e.target.value))}>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {cart.map((item) => {
              const available = getWarehouseStock(item.product.id);
              const overStock = item.qty > available;
              return (
                <div
                  key={item.product.id}
                  className={`rounded-lg border p-2 ${overStock ? "border-red-300 bg-red-50/50" : "border-brand-100"}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-brand-800">{item.product.name}</p>
                    {overStock && (
                      <span className="text-xs font-semibold text-red-500">
                        Tồn kho: {available}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <button className="btn-light" onClick={() => updateQty(item.product.id, item.qty - 1)}>
                      -
                    </button>
                    <input
                      className={`input w-16 text-center ${overStock ? "border-red-300 text-red-600 font-bold" : ""}`}
                      value={item.qty}
                      onChange={(e) => updateQty(item.product.id, Number(e.target.value) || 1)}
                    />
                    <button className="btn-light" onClick={() => updateQty(item.product.id, item.qty + 1)}>
                      +
                    </button>
                    <button className="btn-light ml-auto" onClick={() => removeFromCart(item.product.id)}>
                      Xóa
                    </button>
                  </div>
                  {overStock && (
                    <p className="mt-1 text-xs font-semibold text-red-500">
                      ⚠ Vượt tồn kho {item.qty - available} sản phẩm
                    </p>
                  )}
                  <div className="mt-1 text-right">
                    {isPromoActive(item.product) && (
                      <p className="text-xs text-brand-400 line-through">
                        {money((item.product.customPrice ?? item.product.priceTier?.price ?? 0) * item.qty)} đ
                      </p>
                    )}
                    <p className={`text-sm font-semibold ${isPromoActive(item.product) ? "text-emerald-600" : "text-brand-700"}`}>
                      {money(getEffectivePrice(item.product) * item.qty)} đ
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 space-y-2 border-t border-brand-100 pt-3">
            <div className="flex gap-2">
              <select
                className="input w-32"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "percent" | "amount")}
              >
                <option value="amount">Giảm tiền</option>
                <option value="percent">Giảm %</option>
              </select>
              <input
                className="input flex-1"
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
              />
            </div>

            <div className="rounded-lg bg-brand-50 p-2 text-sm">
              <p className="flex justify-between">
                <span>Tạm tính</span>
                <span>{money(subtotal)} đ</span>
              </p>
              <p className="flex justify-between text-red-600">
                <span>Giảm giá</span>
                <span>-{money(discount)} đ</span>
              </p>
              <p className="mt-1 flex justify-between text-base font-bold text-brand-800">
                <span>Thanh toán</span>
                <span>{money(total)} đ</span>
              </p>
            </div>

            <div className="space-y-2">
              <select
                className="input w-full"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as "CASH" | "BANK" | "MIXED" | "DEBT")}
              >
                <option value="CASH">Tiền mặt</option>
                <option value="BANK">Chuyển khoản</option>
                <option value="MIXED">Kết hợp</option>
                <option value="DEBT">Ghi nợ</option>
              </select>

              {paymentMode === "MIXED" ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="input"
                    type="number"
                    placeholder="Tiền mặt"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(Number(e.target.value) || 0)}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Chuyển khoản"
                    value={bankAmount}
                    onChange={(e) => setBankAmount(Number(e.target.value) || 0)}
                  />
                </div>
              ) : null}
            </div>

            {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

            {cart.some((item) => item.qty > getWarehouseStock(item.product.id)) && (
              <p className="text-sm font-semibold text-red-500">
                ⚠ Có sản phẩm vượt tồn kho, vui lòng điều chỉnh số lượng
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                className="btn-light w-full flex items-center justify-center gap-1.5"
                onClick={() => setReviewOpen(true)}
                disabled={!cart.length}
              >
                📋 Xem trước đơn
              </button>
              <button
                className="btn-primary w-full"
                onClick={completeSale}
                disabled={loading || !cart.length || cart.some((item) => item.qty > getWarehouseStock(item.product.id))}
              >
                {loading ? "Đang xử lý..." : "✓ Thanh toán"}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {scannerOpen && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {/* Order Review Modal */}
      <Modal title="📋 Xem trước đơn hàng" open={reviewOpen} onClose={() => setReviewOpen(false)}>
        <div className="space-y-4">
          {/* Customer & Warehouse info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-brand-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Khách hàng</p>
              <p className="mt-1 font-bold text-brand-800">
                {customers.find((c) => c.id === customerId)?.name ?? "—"}
              </p>
            </div>
            <div className="rounded-lg bg-brand-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Kho xuất</p>
              <p className="mt-1 font-bold text-brand-800">
                {warehouses.find((w) => w.id === warehouseId)?.name ?? "—"}
              </p>
            </div>
          </div>

          {/* Product table */}
          <div className="overflow-x-auto rounded-lg border border-brand-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-200 bg-brand-50/60 text-left">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Sản phẩm</th>
                  <th className="px-3 py-2 text-center">SL</th>
                  <th className="px-3 py-2 text-right">Đơn giá</th>
                  <th className="px-3 py-2 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item, idx) => {
                  const promo = isPromoActive(item.product);
                  const price = getEffectivePrice(item.product);
                  const lineTotal = price * item.qty;
                  const stock = getWarehouseStock(item.product.id);
                  const overStock = item.qty > stock;
                  return (
                    <tr key={item.product.id} className={`border-b border-brand-100 ${overStock ? "bg-red-50/50" : ""}`}>
                      <td className="px-3 py-2 text-brand-500">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-brand-800">{item.product.name}</p>
                        <p className="text-xs text-brand-500">{item.product.sku}</p>
                        {promo && (
                          <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                            🔥 KM
                          </span>
                        )}
                        {overStock && (
                          <p className="mt-0.5 text-[10px] font-bold text-red-500">⚠ Vượt tồn kho ({stock})</p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center font-semibold">{item.qty}</td>
                      <td className="px-3 py-2 text-right">
                        {promo && (
                          <p className="text-xs text-brand-400 line-through">{money(item.product.customPrice ?? item.product.priceTier?.price ?? 0)}</p>
                        )}
                        <p className={promo ? "font-semibold text-emerald-600" : ""}>{money(price)} đ</p>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">{money(lineTotal)} đ</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="rounded-lg bg-gradient-to-br from-brand-50 to-blue-50 p-4">
            <div className="space-y-1 text-sm">
              <p className="flex justify-between">
                <span className="text-brand-600">Tạm tính ({cart.reduce((s, i) => s + i.qty, 0)} sản phẩm)</span>
                <span className="font-semibold">{money(subtotal)} đ</span>
              </p>
              {discount > 0 && (
                <p className="flex justify-between text-red-600">
                  <span>Giảm giá {discountType === "percent" ? `(${discountValue}%)` : ""}</span>
                  <span className="font-semibold">-{money(discount)} đ</span>
                </p>
              )}
              <div className="my-2 border-t border-brand-200" />
              <p className="flex justify-between text-lg font-black text-brand-800">
                <span>Tổng thanh toán</span>
                <span>{money(total)} đ</span>
              </p>
            </div>
          </div>

          {/* Payment info */}
          <div className="rounded-lg border border-brand-100 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Phương thức thanh toán</p>
            <p className="mt-1 font-bold text-brand-800">
              {paymentMode === "CASH" ? "💵 Tiền mặt" : paymentMode === "BANK" ? "🏦 Chuyển khoản" : paymentMode === "DEBT" ? "📝 Ghi nợ" : "💵🏦 Kết hợp"}
              {paymentMode === "MIXED" && (
                <span className="ml-2 text-sm font-normal text-brand-600">
                  (TM: {money(cashAmount)} đ + CK: {money(bankAmount)} đ)
                </span>
              )}
            </p>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button className="btn-light w-full" onClick={() => setReviewOpen(false)}>
              ← Quay lại chỉnh sửa
            </button>
            <button
              className="btn-primary w-full"
              onClick={() => { setReviewOpen(false); completeSale(); }}
              disabled={loading || !cart.length || cart.some((item) => item.qty > getWarehouseStock(item.product.id))}
            >
              {loading ? "Đang xử lý..." : "✓ Xác nhận thanh toán"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
