import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { roleLabel } from "../utils/labels";
import type { Role } from "../types";

const links: Array<{ to: string; label: string; roles: Role[] }> = [
  { to: "/pos", label: "POS", roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { to: "/products", label: "Sản phẩm", roles: ["ADMIN", "MANAGER"] },
  { to: "/warehouses", label: "Kho", roles: ["ADMIN", "MANAGER", "WAREHOUSE"] },
  { to: "/purchases", label: "Nhập hàng", roles: ["ADMIN", "MANAGER", "WAREHOUSE"] },
  { to: "/debts", label: "Công nợ", roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { to: "/reports", label: "Báo cáo", roles: ["ADMIN", "MANAGER", "WAREHOUSE"] },
  { to: "/settings", label: "Cài đặt", roles: ["ADMIN", "MANAGER"] },
];

export const AppLayout = () => {
  const { user, logout } = useAuth();

  const visibleLinks = links.filter((item) => (user?.role ? item.roles.includes(user.role) : false));

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-brand-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xl font-black uppercase tracking-wide text-brand-500">Siêu thị đồng giá</p>
            <p className="text-xs text-brand-700/70">POS + Kho + Báo cáo</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-brand-800">{user?.fullName || user?.email}</p>
            <p className="text-brand-700/70">{roleLabel(user?.role)}</p>
            <button className="btn-light mt-2" onClick={logout}>
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[220px_1fr]">
        <aside className="no-print card h-fit p-2">
          <nav className="flex flex-col gap-1">
            {visibleLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 ${isActive
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-brand-800 hover:bg-brand-50 hover:text-brand-600"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
