import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../../api/client";
import type { PaginatedResponse, Product, Warehouse } from "../../types";

type TransferLine = {
  productId: number;
  qty: number;
};

type CountLine = {
  productId: number;
  countedQty: number;
};

export const WarehousesPage = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockRows, setStockRows] = useState<Array<{ product: Product; qty: number }>>([]);

  const [fromWarehouseId, setFromWarehouseId] = useState(1);
  const [toWarehouseId, setToWarehouseId] = useState(2);
  const [lines, setLines] = useState<TransferLine[]>([{ productId: 1, qty: 1 }]);
  const [note, setNote] = useState("");

  const [adjustWarehouseId, setAdjustWarehouseId] = useState(1);
  const [adjustProductId, setAdjustProductId] = useState(1);
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustNote, setAdjustNote] = useState("");

  const [countWarehouseId, setCountWarehouseId] = useState(1);
  const [countNote, setCountNote] = useState("");
  const [countLines, setCountLines] = useState<CountLine[]>([{ productId: 1, countedQty: 0 }]);

  const [message, setMessage] = useState<string | null>(null);

  const loadData = async () => {
    const [warehouseRes, productRes] = await Promise.all([
      apiRequest<Warehouse[]>("/warehouses"),
      apiRequest<PaginatedResponse<Product>>("/products?page=1&pageSize=300"),
    ]);
    setWarehouses(warehouseRes);
    setProducts(productRes.items);

    if (warehouseRes.length > 0) {
      setFromWarehouseId(warehouseRes[0].id);
      setToWarehouseId(warehouseRes[1]?.id ?? warehouseRes[0].id);
      setAdjustWarehouseId(warehouseRes[0].id);
      setCountWarehouseId(warehouseRes[0].id);
      const stock = await apiRequest<Array<{ product: Product; qty: number }>>(`/warehouses/${warehouseRes[0].id}/stock`);
      setStockRows(stock.filter((row) => row.product));
    }
    if (productRes.items.length > 0) {
      setLines([{ productId: productRes.items[0].id, qty: 1 }]);
      setAdjustProductId(productRes.items[0].id);
      setCountLines([{ productId: productRes.items[0].id, countedQty: 0 }]);
    }
  };

  useEffect(() => {
    loadData().catch((err) => setMessage(err instanceof Error ? err.message : "Tải dữ liệu thất bại"));
  }, []);

  useEffect(() => {
    if (!fromWarehouseId) {
      return;
    }
    apiRequest<Array<{ product: Product; qty: number }>>(`/warehouses/${fromWarehouseId}/stock`)
      .then((rows) => setStockRows(rows.filter((row) => row.product)))
      .catch((err) => setMessage(err instanceof Error ? err.message : "Tải tồn kho thất bại"));
  }, [fromWarehouseId]);

  const addLine = () => {
    setLines((prev) => [...prev, { productId: products[0]?.id ?? 1, qty: 1 }]);
  };

  const updateLine = (index: number, next: TransferLine) => {
    setLines((prev) => prev.map((line, i) => (i === index ? next : line)));
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const addCountLine = () => {
    setCountLines((prev) => [...prev, { productId: products[0]?.id ?? 1, countedQty: 0 }]);
  };

  const updateCountLine = (index: number, next: CountLine) => {
    setCountLines((prev) => prev.map((line, i) => (i === index ? next : line)));
  };

  const removeCountLine = (index: number) => {
    setCountLines((prev) => prev.filter((_, i) => i !== index));
  };

  const submitTransfer = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      await apiRequest("/warehouses/transfer", {
        method: "POST",
        body: JSON.stringify({
          fromWarehouseId,
          toWarehouseId,
          note,
          items: lines,
        }),
      });
      setMessage("Chuyển kho thành công");
      setNote("");
      await loadData();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Chuyển kho thất bại");
    }
  };

  const submitAdjust = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!adjustQty || adjustQty === 0) {
      setMessage("Số lượng điều chỉnh phải khác 0");
      return;
    }

    try {
      await apiRequest("/warehouses/adjust", {
        method: "POST",
        body: JSON.stringify({
          warehouseId: adjustWarehouseId,
          productId: adjustProductId,
          qtyChange: adjustQty,
          note: adjustNote,
        }),
      });
      setMessage("Điều chỉnh tồn kho thành công");
      setAdjustQty(1);
      setAdjustNote("");

      if (fromWarehouseId === adjustWarehouseId) {
        const stock = await apiRequest<Array<{ product: Product; qty: number }>>(`/warehouses/${fromWarehouseId}/stock`);
        setStockRows(stock.filter((row) => row.product));
      }
      await loadData();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Điều chỉnh tồn kho thất bại");
    }
  };

  const submitStockCount = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      await apiRequest("/warehouses/stock-count", {
        method: "POST",
        body: JSON.stringify({
          warehouseId: countWarehouseId,
          note: countNote,
          items: countLines,
        }),
      });

      setMessage("Kiểm kê nhanh thành công");
      setCountNote("");
      await loadData();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Kiểm kê thất bại");
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-brand-800">Kho và chuyển kho</h2>
          <button className="btn-light" onClick={() => loadData().catch(() => undefined)}>
            Tải lại
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {warehouses.map((warehouse) => (
            <div key={warehouse.id} className="rounded-lg border border-brand-100 bg-brand-50 p-3">
              <p className="font-semibold text-brand-800">{warehouse.name}</p>
              <p className="text-xs text-brand-600">{warehouse.location}</p>
              <p className="mt-2 text-sm">Tổng tồn: {warehouse.stockQty ?? 0}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 text-lg font-bold text-brand-800">Tạo lệnh chuyển kho</h3>
          <form className="space-y-3" onSubmit={submitTransfer}>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <select className="input" value={fromWarehouseId} onChange={(e) => setFromWarehouseId(Number(e.target.value))}>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    Từ: {warehouse.name}
                  </option>
                ))}
              </select>
              <select className="input" value={toWarehouseId} onChange={(e) => setToWarehouseId(Number(e.target.value))}>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    Đến: {warehouse.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              {lines.map((line, index) => (
                <div key={index} className="grid grid-cols-[1fr_120px_auto] gap-2">
                  <select
                    className="input"
                    value={line.productId}
                    onChange={(e) => updateLine(index, { ...line, productId: Number(e.target.value) })}
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
                    onChange={(e) => updateLine(index, { ...line, qty: Number(e.target.value) || 1 })}
                  />
                  <button type="button" className="btn-light" onClick={() => removeLine(index)}>
                    Xóa
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button type="button" className="btn-light" onClick={addLine}>
                Thêm dòng
              </button>
              <input className="input flex-1" placeholder="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn-primary">Chuyển kho</button>
            </div>
          </form>
        </div>

        <div className="card p-4">
          <h3 className="mb-3 text-lg font-bold text-brand-800">Điều chỉnh tồn kho</h3>
          <form className="space-y-3" onSubmit={submitAdjust}>
            <select
              className="input w-full"
              value={adjustWarehouseId}
              onChange={(e) => setAdjustWarehouseId(Number(e.target.value))}
            >
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  Kho: {warehouse.name}
                </option>
              ))}
            </select>

            <select
              className="input w-full"
              value={adjustProductId}
              onChange={(e) => setAdjustProductId(Number(e.target.value))}
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>

            <input
              className="input w-full"
              type="number"
              value={adjustQty}
              onChange={(e) => setAdjustQty(Number(e.target.value) || 0)}
              placeholder="Số lượng (+ tăng, - giảm)"
            />

            <input
              className="input w-full"
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              placeholder="Lý do điều chỉnh"
            />

            <button className="btn-primary w-full">Lưu điều chỉnh</button>
          </form>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="mb-3 text-lg font-bold text-brand-800">Kiểm kê nhanh</h3>
        <form className="space-y-3" onSubmit={submitStockCount}>
          <select className="input w-full" value={countWarehouseId} onChange={(e) => setCountWarehouseId(Number(e.target.value))}>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                Kho: {warehouse.name}
              </option>
            ))}
          </select>

          <div className="space-y-2">
            {countLines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_140px_auto] gap-2">
                <select
                  className="input"
                  value={line.productId}
                  onChange={(e) => updateCountLine(idx, { ...line, productId: Number(e.target.value) })}
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
                  min={0}
                  value={line.countedQty}
                  onChange={(e) => updateCountLine(idx, { ...line, countedQty: Number(e.target.value) || 0 })}
                />
                <button type="button" className="btn-light" onClick={() => removeCountLine(idx)}>
                  Xoa
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button type="button" className="btn-light" onClick={addCountLine}>
              Thêm dòng
            </button>
            <input className="input flex-1" placeholder="Ghi chú kiểm kê" value={countNote} onChange={(e) => setCountNote(e.target.value)} />
            <button className="btn-primary">Lưu kiểm kê</button>
          </div>
        </form>
      </div>

      {message ? <p className="text-sm font-semibold text-brand-700">{message}</p> : null}

      <div className="card p-4">
        <h3 className="mb-3 text-lg font-bold text-brand-800">Tồn kho theo kho nguồn</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-200 text-left">
                <th className="py-2">Sản phẩm</th>
                <th className="py-2">SKU</th>
                <th className="py-2 text-right">Số lượng</th>
              </tr>
            </thead>
            <tbody>
              {stockRows.map((row, idx) => (
                <tr key={idx} className="border-b border-brand-100">
                  <td className="py-2">{row.product?.name}</td>
                  <td className="py-2">{row.product?.sku}</td>
                  <td className="py-2 text-right">{row.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
