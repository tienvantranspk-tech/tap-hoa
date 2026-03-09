import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./layouts/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { PosPage } from "./pages/PosPage";
import { ProductsPage } from "./pages/products/ProductsPage";
import { WarehousesPage } from "./pages/warehouses/WarehousesPage";
import { PurchasesPage } from "./pages/purchases/PurchasesPage";
import { ReportsPage } from "./pages/reports/ReportsPage";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { ReceiptPage } from "./pages/ReceiptPage";
import { DebtsPage } from "./pages/debts/DebtsPage";

const basename = import.meta.env.BASE_URL;

export const App = () => {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/pos" element={<PosPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/warehouses" element={<WarehousesPage />} />
            <Route path="/purchases" element={<PurchasesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/debts" element={<DebtsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="/receipt/:id" element={<ReceiptPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
