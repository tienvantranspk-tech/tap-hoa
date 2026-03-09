import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../../api/client";
import { Modal } from "../../components/Modal";
import type { PaginatedResponse, PriceTier, Product } from "../../types";
import JsBarcode from "jsbarcode";

const money = (value: number) => value.toLocaleString("vi-VN");

type PricingMode = "TIER" | "CUSTOM";

type PromoStatus = "active" | "scheduled" | "expired" | "none";

const getPromoStatus = (product: Product): PromoStatus => {
  if (product.promoPrice == null) return "none";
  const now = new Date();
  const start = product.promoStartAt ? new Date(product.promoStartAt) : null;
  const end = product.promoEndAt ? new Date(product.promoEndAt) : null;
  if (end && end < now) return "expired";
  if (start && start > now) return "scheduled";
  return "active";
};

const promoStatusConfig: Record<Exclude<PromoStatus, "none">, { label: string; bg: string; text: string; dot: string }> = {
  active: { label: "Đang KM", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  scheduled: { label: "Sắp KM", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  expired: { label: "Hết hạn", bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" },
};

const generateEAN13 = () => {
  const prefix = "893600";
  const rand = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  const base = prefix + rand;
  // Calculate EAN-13 check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return base + check;
};

const emptyForm = {
  sku: "",
  barcode: "",
  name: "",
  unit: "pcs",
  pricingMode: "TIER" as PricingMode,
  priceTierId: 1 as number | null,
  customPrice: "" as number | "",
  cost: 0,
  minStock: 0,
  active: true,
  promoPrice: "" as number | "",
  promoStartAt: "",
  promoEndAt: "",
};

type StockFilter = "ALL" | "LOW" | "OUT" | "IN";

export const ProductsPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [search, setSearch] = useState("");
  const [filterTierId, setFilterTierId] = useState<number | "ALL">("ALL");
  const [stockFilter, setStockFilter] = useState<StockFilter>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [printProduct, setPrintProduct] = useState<Product | null>(null);
  const [printQty, setPrintQty] = useState(1);
  const printRef = useRef<HTMLDivElement>(null);

  const loadProducts = async (nextPage = page) => {
    const params = new URLSearchParams({
      page: String(nextPage),
      pageSize: "20",
    });

    if (search.trim()) {
      params.set("search", search.trim());
    }
    if (filterTierId !== "ALL") {
      params.set("priceTierId", String(filterTierId));
    }
    if (stockFilter !== "ALL") {
      params.set("stockStatus", stockFilter);
    }

    const productRes = await apiRequest<PaginatedResponse<Product>>(`/products?${params.toString()}`);
    setProducts(productRes.items);
    setPage(productRes.page);
    setTotalPages(productRes.totalPages);
  };

  const loadTiers = async () => {
    const tierRes = await apiRequest<PriceTier[]>("/settings/price-tiers");
    setTiers(tierRes);
  };

  const loadData = async (nextPage = 1) => {
    await Promise.all([loadProducts(nextPage), loadTiers()]);
  };

  useEffect(() => {
    loadData(1).catch((err) => setError(err instanceof Error ? err.message : "Tải dữ liệu thất bại"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tiers.length && !form.priceTierId) {
      setForm((prev) => ({ ...prev, priceTierId: tiers[0].id }));
    }
  }, [tiers, form.priceTierId]);

  const filtered = useMemo(() => products, [products]);

  const openCreate = () => {
    setEditing(null);
    const nextNum = products.length > 0
      ? Math.max(...products.map((p) => {
        const match = p.sku.match(/\d+/);
        return match ? Number(match[0]) : 0;
      })) + 1
      : 1;
    const sku = `SP${String(nextNum).padStart(3, "0")}`;
    const barcode = generateEAN13();
    setForm({ ...emptyForm, sku, barcode, pricingMode: "TIER", priceTierId: tiers[0]?.id ?? 1, customPrice: "" });
    setOpenModal(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    const isCustom = product.customPrice != null;
    setForm({
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      unit: product.unit,
      pricingMode: isCustom ? "CUSTOM" : "TIER",
      priceTierId: product.priceTierId ?? (tiers[0]?.id ?? null),
      customPrice: product.customPrice ?? "",
      cost: product.cost,
      minStock: product.minStock,
      active: product.active,
      promoPrice: product.promoPrice ?? "",
      promoStartAt: product.promoStartAt ? new Date(product.promoStartAt).toISOString().slice(0, 16) : "",
      promoEndAt: product.promoEndAt ? new Date(product.promoEndAt).toISOString().slice(0, 16) : "",
    });
    setOpenModal(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const payload = {
        sku: form.sku,
        barcode: form.barcode,
        name: form.name,
        unit: form.unit,
        cost: form.cost,
        minStock: form.minStock,
        active: form.active,
        priceTierId: form.pricingMode === "TIER" ? form.priceTierId : null,
        customPrice: form.pricingMode === "CUSTOM" ? (form.customPrice === "" ? null : form.customPrice) : null,
        promoPrice: form.promoPrice === "" ? null : form.promoPrice,
        promoStartAt: form.promoStartAt || null,
        promoEndAt: form.promoEndAt || null,
      };

      if (editing) {
        await apiRequest(`/products/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setOpenModal(false);
      await loadData(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu thất bại");
    }
  };

  const removeProduct = async (id: number) => {
    if (!window.confirm("Ngưng bán sản phẩm này?")) {
      return;
    }
    await apiRequest(`/products/${id}`, { method: "DELETE" });
    await loadData(page);
  };

  const viewHistory = async (id: number) => {
    const data = await apiRequest<any[]>(`/products/${id}/tier-history`);
    setHistory(data);
  };

  const runSearch = () => {
    loadProducts(1).catch((err) => setError(err instanceof Error ? err.message : "Tải dữ liệu thất bại"));
  };

  const openPrint = (product: Product) => {
    setPrintProduct(product);
    setPrintQty(1);
  };

  const doPrint = () => {
    if (!printRef.current || !printProduct) return;

    // Render barcodes into SVGs
    const svgs = printRef.current.querySelectorAll("svg.barcode-svg");
    svgs.forEach((svg) => {
      try {
        JsBarcode(svg, printProduct.barcode, {
          format: "EAN13",
          width: 1.5,
          height: 40,
          fontSize: 12,
          margin: 2,
          displayValue: true,
        });
      } catch {
        JsBarcode(svg, printProduct.barcode, {
          format: "CODE128",
          width: 1.5,
          height: 40,
          fontSize: 12,
          margin: 2,
          displayValue: true,
        });
      }
    });

    // Print
    const printWindow = window.open("", "_blank", "width=600,height=800");
    if (!printWindow) return;

    const tierName = printProduct.customPrice != null ? "Giá riêng" : (printProduct.priceTier?.name || "");
    const price = (printProduct.customPrice ?? printProduct.priceTier?.price ?? 0).toLocaleString("vi-VN");

    let labelsHtml = "";
    for (let i = 0; i < printQty; i++) {
      labelsHtml += `
        <div style="display:inline-block;width:50mm;height:30mm;border:0.5px dashed #ccc;padding:2mm;box-sizing:border-box;text-align:center;page-break-inside:avoid;vertical-align:top;margin:1mm;">
          <div style="font-weight:700;font-size:9px;margin-bottom:1px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${printProduct.name}</div>
          <div style="font-size:8px;color:#666;margin-bottom:2px;">${tierName} - ${price} đ</div>
          ${printRef.current!.querySelectorAll("svg.barcode-svg")[i]?.outerHTML || ""}
        </div>`;
    }

    printWindow.document.write(`
      <html>
      <head>
        <title>In mã vạch - ${printProduct.name}</title>
        <style>
          @page { margin: 5mm; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        </style>
      </head>
      <body>${labelsHtml}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  // Render barcode SVGs when print modal opens
  useEffect(() => {
    if (printProduct && printRef.current) {
      const timer = setTimeout(() => {
        const svgs = printRef.current?.querySelectorAll("svg.barcode-svg");
        svgs?.forEach((svg) => {
          try {
            JsBarcode(svg, printProduct.barcode, {
              format: "EAN13",
              width: 1.8,
              height: 50,
              fontSize: 13,
              margin: 4,
              displayValue: true,
            });
          } catch {
            JsBarcode(svg, printProduct.barcode, {
              format: "CODE128",
              width: 1.8,
              height: 50,
              fontSize: 13,
              margin: 4,
              displayValue: true,
            });
          }
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [printProduct, printQty]);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-brand-800">Quản lý sản phẩm</h2>
          <button className="btn-primary" onClick={openCreate}>
            Thêm sản phẩm
          </button>
        </div>

        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_220px_200px_auto]">
          <input
            className="input"
            placeholder="Tìm theo tên / SKU / mã vạch"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input"
            value={filterTierId}
            onChange={(e) => setFilterTierId(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
          >
            <option value="ALL">Tất cả mức giá</option>
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.name}
              </option>
            ))}
          </select>
          <select className="input" value={stockFilter} onChange={(e) => setStockFilter(e.target.value as StockFilter)}>
            <option value="ALL">Tất cả tồn kho</option>
            <option value="LOW">Tồn thấp</option>
            <option value="OUT">Hết hàng</option>
            <option value="IN">Tồn dư</option>
          </select>
          <button className="btn-light" onClick={runSearch}>
            Lọc
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-200 text-left">
                <th className="py-2">SKU</th>
                <th className="py-2">Tên</th>
                <th className="py-2">Giá</th>
                <th className="py-2">Khuyến mãi</th>
                <th className="py-2 text-right">Tồn</th>
                <th className="py-2 text-right">Min</th>
                <th className="py-2">Trạng thái</th>
                <th className="py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const promoStatus = getPromoStatus(item);
                const cfg = promoStatus !== "none" ? promoStatusConfig[promoStatus] : null;
                return (
                  <tr key={item.id} className="border-b border-brand-100">
                    <td className="py-2">{item.sku}</td>
                    <td className="py-2">
                      <p className="font-semibold text-brand-800">{item.name}</p>
                      <p className="text-xs text-brand-600">{item.barcode}</p>
                    </td>
                    <td className="py-2">
                      {item.customPrice != null ? (
                        <div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
                            💰 Giá riêng
                          </span>
                          <p className="text-sm font-bold text-purple-600 mt-0.5">{money(item.customPrice)} đ</p>
                        </div>
                      ) : (
                        <div>
                          <span className="text-xs text-brand-600">{item.priceTier?.name}</span>
                          <p className="text-sm font-semibold text-brand-700">{money(item.priceTier?.price ?? 0)} đ</p>
                        </div>
                      )}
                    </td>
                    <td className="py-2">
                      {cfg ? (
                        <div className="space-y-1">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} style={{ animation: promoStatus === "active" ? "pulse 2s infinite" : "none" }} />
                            {cfg.label}
                          </span>
                          <p className="text-sm font-bold text-emerald-600">
                            {money(item.promoPrice!)} đ
                          </p>
                          <p className="text-xs text-brand-500">
                            {item.promoStartAt ? new Date(item.promoStartAt).toLocaleDateString("vi-VN") : "∞"}
                            {" → "}
                            {item.promoEndAt ? new Date(item.promoEndAt).toLocaleDateString("vi-VN") : "∞"}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-brand-400">—</span>
                      )}
                    </td>
                    <td className="py-2 text-right">{item.stockQty ?? 0}</td>
                    <td className="py-2 text-right">{item.minStock}</td>
                    <td className="py-2">{item.active ? "Đang bán" : "Ngưng bán"}</td>
                    <td className="py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <button className="btn-light" onClick={() => openPrint(item)}>
                          🏷 In mã
                        </button>
                        <button className="btn-light" onClick={() => viewHistory(item.id)}>
                          Log giá
                        </button>
                        <button className="btn-light" onClick={() => openEdit(item)}>
                          Sửa
                        </button>
                        <button className="btn-light" onClick={() => removeProduct(item.id)}>
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button className="btn-light" disabled={page <= 1} onClick={() => loadProducts(page - 1)}>
              Trước
            </button>
            <span className="text-sm text-brand-700">
              Trang {page}/{totalPages}
            </span>
            <button className="btn-light" disabled={page >= totalPages} onClick={() => loadProducts(page + 1)}>
              Tiếp
            </button>
          </div>
        </div>
      </div>

      {history.length > 0 ? (
        <div className="card p-4">
          <h3 className="mb-2 text-lg font-bold text-brand-800">Lịch sử đổi mức giá</h3>
          <ul className="space-y-1 text-sm">
            {history.map((row) => (
              <li key={row.id}>
                {new Date(row.changedAt).toLocaleString("vi-VN")} - {row.oldPriceTier?.name} -&gt; {row.newPriceTier?.name} (
                {row.changedBy?.email})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Modal title={editing ? "Cập nhật sản phẩm" : "Tạo sản phẩm"} open={openModal} onClose={() => setOpenModal(false)}>
        <form className="grid grid-cols-1 gap-2 md:grid-cols-2" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-700">SKU</label>
            <input className="input w-full" placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-700">Barcode</label>
            <div className="flex gap-1">
              <input
                className="input flex-1"
                placeholder="Barcode"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              />
              {!editing && (
                <button
                  type="button"
                  className="btn-light shrink-0 text-xs"
                  onClick={() => setForm({ ...form, barcode: generateEAN13() })}
                  title="Tạo mã vạch mới"
                >
                  🔄
                </button>
              )}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-brand-700">Tên sản phẩm</label>
            <input className="input w-full" placeholder="Tên" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-700">Đơn vị</label>
            <input className="input w-full" placeholder="Đơn vị" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-brand-700">Loại giá</label>
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all ${form.pricingMode === "TIER"
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-brand-100 text-brand-400 hover:border-brand-200"
                  }`}
                onClick={() => setForm({ ...form, pricingMode: "TIER", customPrice: "" })}
              >
                🏷 Đồng giá (Tier)
              </button>
              <button
                type="button"
                className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all ${form.pricingMode === "CUSTOM"
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-brand-100 text-brand-400 hover:border-brand-200"
                  }`}
                onClick={() => setForm({ ...form, pricingMode: "CUSTOM", priceTierId: null })}
              >
                💰 Giá riêng
              </button>
            </div>
          </div>
          {form.pricingMode === "TIER" ? (
            <div>
              <label className="mb-1 block text-xs font-semibold text-brand-700">Mức đồng giá</label>
              <select className="input w-full" value={form.priceTierId ?? ""} onChange={(e) => setForm({ ...form, priceTierId: Number(e.target.value) })}>
                {tiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name} - {money(tier.price)} đ
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold text-brand-700">Giá bán (đ)</label>
              <input
                className="input w-full"
                type="number"
                placeholder="Nhập giá bán"
                value={form.customPrice}
                onChange={(e) => setForm({ ...form, customPrice: e.target.value ? Number(e.target.value) : "" })}
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-700">Giá vốn</label>
            <input
              className="input w-full"
              type="number"
              placeholder="Giá vốn"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-700">Tồn tối thiểu</label>
            <input
              className="input w-full"
              type="number"
              placeholder="Tồn tối thiểu"
              value={form.minStock}
              onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-700">Giá khuyến mãi (tuỳ chọn)</label>
            <input
              className="input w-full"
              type="number"
              placeholder="Giá KM"
              value={form.promoPrice}
              onChange={(e) => setForm({ ...form, promoPrice: e.target.value ? Number(e.target.value) : "" })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-700">Ngày bắt đầu KM</label>
            <input
              className="input w-full"
              type="datetime-local"
              value={form.promoStartAt}
              onChange={(e) => setForm({ ...form, promoStartAt: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-brand-700">Ngày kết thúc KM</label>
            <input
              className="input w-full"
              type="datetime-local"
              value={form.promoEndAt}
              onChange={(e) => setForm({ ...form, promoEndAt: e.target.value })}
            />
          </div>

          {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}
          <button className="btn-primary md:col-span-2">Lưu</button>
        </form>
      </Modal>

      <Modal title="In mã vạch" open={!!printProduct} onClose={() => setPrintProduct(null)}>
        {printProduct && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="font-bold text-brand-800">{printProduct.name}</p>
              <p className="text-sm text-brand-700/70">
                {printProduct.sku} •{" "}
                {printProduct.customPrice != null
                  ? `Giá riêng • ${printProduct.customPrice.toLocaleString("vi-VN")} đ`
                  : `${printProduct.priceTier?.name ?? ""} • ${(printProduct.priceTier?.price ?? 0).toLocaleString("vi-VN")} đ`
                }
              </p>
            </div>

            <div className="flex justify-center">
              <svg className="barcode-preview" />
            </div>

            <div className="flex items-center justify-center gap-3">
              <label className="text-sm font-semibold text-brand-700">Số lượng nhãn:</label>
              <input
                className="input w-20 text-center"
                type="number"
                min={1}
                max={100}
                value={printQty}
                onChange={(e) => setPrintQty(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
              />
            </div>

            {/* Hidden SVGs for print */}
            <div ref={printRef} className="hidden">
              {Array.from({ length: printQty }).map((_, i) => (
                <svg key={i} className="barcode-svg" />
              ))}
            </div>

            <button className="btn-primary w-full" onClick={doPrint}>
              🖨 In {printQty} nhãn mã vạch
            </button>
          </div>
        )}
      </Modal>

      {/* Render preview barcode */}
      <BarcodeSvgPreview barcode={printProduct?.barcode ?? null} />
    </div>
  );
};

/** Tiny helper to render a preview barcode via useEffect */
const BarcodeSvgPreview = ({ barcode }: { barcode: string | null }) => {
  useEffect(() => {
    if (!barcode) return;
    const svg = document.querySelector("svg.barcode-preview");
    if (!svg) return;
    try {
      JsBarcode(svg, barcode, {
        format: "EAN13",
        width: 2,
        height: 60,
        fontSize: 14,
        margin: 6,
        displayValue: true,
      });
    } catch {
      JsBarcode(svg, barcode, {
        format: "CODE128",
        width: 2,
        height: 60,
        fontSize: 14,
        margin: 6,
        displayValue: true,
      });
    }
  }, [barcode]);
  return null;
};
