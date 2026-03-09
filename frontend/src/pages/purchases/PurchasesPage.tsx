import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../../api/client";
import type { PaginatedResponse, Product, PurchaseReceipt, Supplier, Warehouse } from "../../types";

type PurchaseLineForm = {
  productId: number;
  qty: number;
  unitCost: number;
};

export const PurchasesPage = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([]);

  const [supplierId, setSupplierId] = useState(1);
  const [warehouseId, setWarehouseId] = useState(1);
  const [lines, setLines] = useState<PurchaseLineForm[]>([{ productId: 1, qty: 1, unitCost: 1000 }]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  const loadReceipts = async (nextPage = page) => {
    const params = new URLSearchParams({
      page: String(nextPage),
      pageSize: "20",
    });
    if (search.trim()) {
      params.set("search", search.trim());
    }
    const receiptRes = await apiRequest<PaginatedResponse<PurchaseReceipt>>(`/purchases/receipts?${params.toString()}`);
    setReceipts(receiptRes.items);
    setPage(receiptRes.page);
    setTotalPages(receiptRes.totalPages);
  };

  const loadData = async (nextPage = 1) => {
    const [supplierRes, warehouseRes, productRes] = await Promise.all([
      apiRequest<Supplier[]>("/settings/suppliers"),
      apiRequest<Warehouse[]>("/warehouses"),
      apiRequest<PaginatedResponse<Product>>("/products?page=1&pageSize=300"),
    ]);

    setSuppliers(supplierRes);
    setWarehouses(warehouseRes);
    setProducts(productRes.items);

    if (supplierRes.length) {
      setSupplierId((prev) => (supplierRes.some((item) => item.id === prev) ? prev : supplierRes[0].id));
    }
    if (warehouseRes.length) {
      setWarehouseId((prev) => (warehouseRes.some((item) => item.id === prev) ? prev : warehouseRes[0].id));
    }
    if (productRes.items.length) {
      setLines([{ productId: productRes.items[0].id, qty: 1, unitCost: Math.round(productRes.items[0].cost || 1000) }]);
    }

    await loadReceipts(nextPage);
  };

  useEffect(() => {
    loadData(1).catch((err) => setMessage(err instanceof Error ? err.message : "Tải dữ liệu thất bại"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addLine = () => {
    setLines((prev) => [...prev, { productId: products[0]?.id ?? 1, qty: 1, unitCost: 1000 }]);
  };

  const updateLine = (index: number, patch: Partial<PurchaseLineForm>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      await apiRequest("/purchases/receipts", {
        method: "POST",
        body: JSON.stringify({
          supplierId,
          warehouseId,
          items: lines,
        }),
      });
      setMessage("Nhập hàng thành công");
      await loadData(page);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Tạo phiếu nhập thất bại");
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h2 className="mb-3 text-xl font-bold text-brand-800">Nhập hàng (GRN)</h2>
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value))}>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <select className="input" value={warehouseId} onChange={(e) => setWarehouseId(Number(e.target.value))}>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_100px_140px_auto] gap-2">
                <select
                  className="input"
                  value={line.productId}
                  onChange={(e) => updateLine(idx, { productId: Number(e.target.value) })}
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  type="number"
                  value={line.qty}
                  onChange={(e) => updateLine(idx, { qty: Number(e.target.value) || 1 })}
                />
                <input
                  className="input"
                  type="number"
                  value={line.unitCost}
                  onChange={(e) => updateLine(idx, { unitCost: Number(e.target.value) || 0 })}
                />
                <button type="button" className="btn-light" onClick={() => removeLine(idx)}>
                  Xóa
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button type="button" className="btn-light" onClick={addLine}>
              Thêm dòng
            </button>
            <button className="btn-primary">Tạo phiếu nhập</button>
          </div>
        </form>

        {message ? <p className="mt-2 text-sm font-semibold text-brand-700">{message}</p> : null}
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-brand-800">Lịch sử phiếu nhập</h3>
          <div className="flex gap-2">
            <input
              className="input w-56"
              placeholder="Tìm code / NCC"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn-light" onClick={() => loadReceipts(1).catch(() => undefined)}>
              Tìm
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-200 text-left">
                <th className="py-2">Code</th>
                <th className="py-2">Ngày</th>
                <th className="py-2 text-right">Tổng chi phí</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.id} className="border-b border-brand-100">
                  <td className="py-2 font-semibold text-brand-700">{receipt.code}</td>
                  <td className="py-2">{new Date(receipt.createdAt).toLocaleString("vi-VN")}</td>
                  <td className="py-2 text-right">{receipt.totalCost.toLocaleString("vi-VN")} đ</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button className="btn-light" disabled={page <= 1} onClick={() => loadReceipts(page - 1)}>
              Trước
            </button>
            <span className="text-sm text-brand-700">
              Trang {page}/{totalPages}
            </span>
            <button className="btn-light" disabled={page >= totalPages} onClick={() => loadReceipts(page + 1)}>
              Tiếp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
