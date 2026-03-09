import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../../api/client";
import { Modal } from "../../components/Modal";
import type { Customer, PriceTier, Supplier, User, Warehouse } from "../../types";
import { roleLabel } from "../../utils/labels";

export const SettingsPage = () => {
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [tierName, setTierName] = useState("");
  const [tierPrice, setTierPrice] = useState(10000);
  const [tierEditing, setTierEditing] = useState<PriceTier | null>(null);

  const [userForm, setUserForm] = useState({
    email: "",
    password: "123456",
    role: "CASHIER",
    fullName: "",
  });

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerEditingId, setCustomerEditingId] = useState<number | null>(null);

  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierEditingId, setSupplierEditingId] = useState<number | null>(null);

  const [warehouseName, setWarehouseName] = useState("");
  const [warehouseLocation, setWarehouseLocation] = useState("");
  const [warehouseEditing, setWarehouseEditing] = useState<Warehouse | null>(null);

  const loadData = async () => {
    const [tierRes, userRes, customerRes, supplierRes, warehouseRes] = await Promise.all([
      apiRequest<PriceTier[]>("/settings/price-tiers"),
      apiRequest<User[]>("/settings/users"),
      apiRequest<Customer[]>("/settings/customers"),
      apiRequest<Supplier[]>("/settings/suppliers"),
      apiRequest<Warehouse[]>("/warehouses"),
    ]);
    setTiers(tierRes);
    setUsers(userRes);
    setCustomers(customerRes);
    setSuppliers(supplierRes);
    setWarehouses(warehouseRes);
  };

  useEffect(() => {
    loadData().catch((err) => setMessage(err instanceof Error ? err.message : "Tải cấu hình thất bại"));
  }, []);

  const createTier = async (e: FormEvent) => {
    e.preventDefault();
    await apiRequest("/settings/price-tiers", {
      method: "POST",
      body: JSON.stringify({ name: tierName, price: tierPrice }),
    });
    setTierName("");
    setTierPrice(10000);
    await loadData();
  };

  const saveTierEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tierEditing) return;
    await apiRequest(`/settings/price-tiers/${tierEditing.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: tierEditing.name, price: tierEditing.price }),
    });
    setTierEditing(null);
    await loadData();
  };

  const createUser = async (e: FormEvent) => {
    e.preventDefault();
    await apiRequest("/settings/users", {
      method: "POST",
      body: JSON.stringify(userForm),
    });
    setUserForm({ email: "", password: "123456", role: "CASHIER", fullName: "" });
    await loadData();
  };

  const submitCustomer = async (e: FormEvent) => {
    e.preventDefault();
    if (customerEditingId) {
      await apiRequest(`/settings/customers/${customerEditingId}`, {
        method: "PUT",
        body: JSON.stringify({ name: customerName, phone: customerPhone || undefined, address: customerAddress || undefined }),
      });
    } else {
      await apiRequest("/settings/customers", {
        method: "POST",
        body: JSON.stringify({ name: customerName, phone: customerPhone || undefined, address: customerAddress || undefined }),
      });
    }

    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setCustomerEditingId(null);
    setCustomerModalOpen(false);
    await loadData();
  };

  const submitSupplier = async (e: FormEvent) => {
    e.preventDefault();
    if (supplierEditingId) {
      await apiRequest(`/settings/suppliers/${supplierEditingId}`, {
        method: "PUT",
        body: JSON.stringify({ name: supplierName, phone: supplierPhone || undefined, address: supplierAddress || undefined }),
      });
    } else {
      await apiRequest("/settings/suppliers", {
        method: "POST",
        body: JSON.stringify({ name: supplierName, phone: supplierPhone || undefined, address: supplierAddress || undefined }),
      });
    }

    setSupplierName("");
    setSupplierPhone("");
    setSupplierAddress("");
    setSupplierEditingId(null);
    setSupplierModalOpen(false);
    await loadData();
  };

  const openAddCustomer = () => {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setCustomerEditingId(null);
    setCustomerModalOpen(true);
  };

  const openEditCustomer = (c: Customer) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone || "");
    setCustomerAddress(c.address || "");
    setCustomerEditingId(c.id);
    setCustomerModalOpen(true);
  };

  const openAddSupplier = () => {
    setSupplierName("");
    setSupplierPhone("");
    setSupplierAddress("");
    setSupplierEditingId(null);
    setSupplierModalOpen(true);
  };

  const openEditSupplier = (s: Supplier) => {
    setSupplierName(s.name);
    setSupplierPhone(s.phone || "");
    setSupplierAddress(s.address || "");
    setSupplierEditingId(s.id);
    setSupplierModalOpen(true);
  };

  const createWarehouse = async (e: FormEvent) => {
    e.preventDefault();
    await apiRequest("/warehouses", {
      method: "POST",
      body: JSON.stringify({ name: warehouseName, location: warehouseLocation || undefined }),
    });
    setWarehouseName("");
    setWarehouseLocation("");
    await loadData();
  };

  const saveWarehouseEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!warehouseEditing) return;
    await apiRequest(`/warehouses/${warehouseEditing.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: warehouseEditing.name, location: warehouseEditing.location || "" }),
    });
    setWarehouseEditing(null);
    await loadData();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 text-lg font-bold text-brand-800">Mức đồng giá</h2>
          <form className="mb-3 flex gap-2" onSubmit={createTier}>
            <input className="input flex-1" placeholder="Tên mức giá" value={tierName} onChange={(e) => setTierName(e.target.value)} />
            <input className="input w-40" type="number" value={tierPrice} onChange={(e) => setTierPrice(Number(e.target.value) || 0)} />
            <button className="btn-primary">Thêm</button>
          </form>
          <ul className="space-y-1 text-sm">
            {tiers.map((tier) => (
              <li key={tier.id} className="flex items-center justify-between rounded border border-brand-100 px-2 py-1">
                <span>
                  {tier.name} - {tier.price.toLocaleString("vi-VN")} đ
                </span>
                <button className="btn-light" onClick={() => setTierEditing(tier)}>
                  Sửa
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-4">
          <h2 className="mb-3 text-lg font-bold text-brand-800">Người dùng</h2>
          <form className="grid grid-cols-1 gap-2 md:grid-cols-2" onSubmit={createUser}>
            <input className="input" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
            <input
              className="input"
              placeholder="Họ tên"
              value={userForm.fullName}
              onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
            />
            <input
              className="input"
              placeholder="Mật khẩu"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
            />
            <select className="input" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="CASHIER">CASHIER</option>
              <option value="WAREHOUSE">WAREHOUSE</option>
            </select>
            <button className="btn-primary md:col-span-2">Thêm người dùng</button>
          </form>

          <ul className="mt-3 space-y-1 text-sm">
            {users.map((user) => (
              <li key={user.id} className="rounded border border-brand-100 px-2 py-1">
                {user.email} - {roleLabel(user.role)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold text-brand-800">Khách hàng</h3>
            <button className="btn-primary flex items-center gap-1 text-sm py-1.5 px-3" onClick={openAddCustomer}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Thêm
            </button>
          </div>
          <ul className="space-y-2 text-sm">
            {customers.map((customer) => (
              <li key={customer.id} className="block rounded-lg border border-brand-100 bg-brand-50/20 p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-brand-800 text-base">{customer.name}</p>
                    {customer.phone && <p className="text-brand-600 flex items-center gap-1 mt-1"><span className="text-xs">📞</span> {customer.phone}</p>}
                    {customer.address && <p className="text-brand-600 flex items-center gap-1 mt-1"><span className="text-xs">📍</span> {customer.address}</p>}
                  </div>
                  <button className="btn-light text-xs" onClick={() => openEditCustomer(customer)}>Sửa</button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold text-brand-800">Nhà cung cấp</h3>
            <button className="btn-primary flex items-center gap-1 text-sm py-1.5 px-3" onClick={openAddSupplier}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Thêm
            </button>
          </div>
          <ul className="space-y-2 text-sm">
            {suppliers.map((supplier) => (
              <li key={supplier.id} className="block rounded-lg border border-brand-100 bg-brand-50/20 p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-brand-800 text-base">{supplier.name}</p>
                    {supplier.phone && <p className="text-brand-600 flex items-center gap-1 mt-1"><span className="text-xs">📞</span> {supplier.phone}</p>}
                    {supplier.address && <p className="text-brand-600 flex items-center gap-1 mt-1"><span className="text-xs">📍</span> {supplier.address}</p>}
                  </div>
                  <button className="btn-light text-xs" onClick={() => openEditSupplier(supplier)}>Sửa</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="mb-3 text-lg font-bold text-brand-800">Quản lý kho</h3>
        <form className="mb-3 flex gap-2" onSubmit={createWarehouse}>
          <input className="input flex-1" placeholder="Tên kho" value={warehouseName} onChange={(e) => setWarehouseName(e.target.value)} />
          <input className="input w-48" placeholder="Địa chỉ" value={warehouseLocation} onChange={(e) => setWarehouseLocation(e.target.value)} />
          <button className="btn-primary">Thêm kho</button>
        </form>
        <ul className="space-y-1 text-sm">
          {warehouses.map((wh) => (
            <li key={wh.id} className="flex items-center justify-between rounded border border-brand-100 px-2 py-1">
              <span>
                <strong>{wh.name}</strong>{wh.location ? ` — ${wh.location}` : ""}
              </span>
              <button className="btn-light" onClick={() => setWarehouseEditing({ ...wh })}>
                Sửa
              </button>
            </li>
          ))}
        </ul>
      </div>

      {message ? <p className="text-sm text-red-600">{message}</p> : null}

      <Modal title="Sửa mức đồng giá" open={!!tierEditing} onClose={() => setTierEditing(null)}>
        <form className="space-y-2" onSubmit={saveTierEdit}>
          <input
            className="input w-full"
            value={tierEditing?.name || ""}
            onChange={(e) => setTierEditing((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
          />
          <input
            className="input w-full"
            type="number"
            value={tierEditing?.price || 0}
            onChange={(e) => setTierEditing((prev) => (prev ? { ...prev, price: Number(e.target.value) || 0 } : prev))}
          />
          <button className="btn-primary w-full">Lưu thay đổi</button>
        </form>
      </Modal>

      <Modal title="Sửa thông tin kho" open={!!warehouseEditing} onClose={() => setWarehouseEditing(null)}>
        <form className="space-y-2" onSubmit={saveWarehouseEdit}>
          <input
            className="input w-full"
            placeholder="Tên kho"
            value={warehouseEditing?.name || ""}
            onChange={(e) => setWarehouseEditing((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
          />
          <input
            className="input w-full"
            placeholder="Địa chỉ"
            value={warehouseEditing?.location || ""}
            onChange={(e) => setWarehouseEditing((prev) => (prev ? { ...prev, location: e.target.value } : prev))}
          />
          <button className="btn-primary w-full mt-2">Lưu thay đổi</button>
        </form>
      </Modal>

      <Modal title={customerEditingId ? "Sửa khách hàng" : "Thêm khách hàng"} open={customerModalOpen} onClose={() => setCustomerModalOpen(false)}>
        <form className="space-y-3" onSubmit={submitCustomer}>
          <div>
            <label className="mb-1 block text-sm font-semibold text-brand-700">Tên khách hàng</label>
            <input className="input w-full" placeholder="Nguyễn Văn A" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-brand-700">Số điện thoại</label>
            <input className="input w-full" placeholder="09xxxxxxxxx" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-brand-700">Địa chỉ</label>
            <textarea className="input w-full resize-none" rows={3} placeholder="123 Đường B, Quận C..." value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)}></textarea>
          </div>
          <button className="btn-primary w-full mt-2" type="submit">Lưu</button>
        </form>
      </Modal>

      <Modal title={supplierEditingId ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"} open={supplierModalOpen} onClose={() => setSupplierModalOpen(false)}>
        <form className="space-y-3" onSubmit={submitSupplier}>
          <div>
            <label className="mb-1 block text-sm font-semibold text-brand-700">Tên nhà cung cấp</label>
            <input className="input w-full" placeholder="Công ty TNHH..." value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-brand-700">Số điện thoại</label>
            <input className="input w-full" placeholder="09xxxxxxxxx" value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-brand-700">Địa chỉ</label>
            <textarea className="input w-full resize-none" rows={3} placeholder="123 Khu Công Nghiệp..." value={supplierAddress} onChange={(e) => setSupplierAddress(e.target.value)}></textarea>
          </div>
          <button className="btn-primary w-full mt-2" type="submit">Lưu</button>
        </form>
      </Modal>
    </div>
  );
};
