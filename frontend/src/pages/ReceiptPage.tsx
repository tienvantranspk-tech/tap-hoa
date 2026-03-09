import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import type { SalesInvoice } from "../types";

const money = (value: number) => value.toLocaleString("vi-VN");

export const ReceiptPage = () => {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    apiRequest<SalesInvoice>(`/sales/receipt/${id}`).then(setInvoice).catch(console.error);
  }, [id]);

  if (!invoice) {
    return <div className="p-6">Đang tải hóa đơn...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="no-print mb-4 flex justify-end gap-2">
        <button className="btn-light" onClick={() => window.history.back()}>
          Quay lại
        </button>
        <button className="btn-primary" onClick={() => window.print()}>
          In hóa đơn
        </button>
      </div>

      <div className="receipt-paper card p-6">
        <h1 className="text-center text-2xl font-black uppercase text-brand-800">Siêu thị đồng giá</h1>
        <p className="mt-1 text-center text-sm text-brand-600">Hóa đơn bán lẻ</p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <p>
            <span className="font-semibold">Mã HD:</span> {invoice.code}
          </p>
          <p>
            <span className="font-semibold">Ngày:</span> {new Date(invoice.createdAt).toLocaleString("vi-VN")}
          </p>
          <p>
            <span className="font-semibold">Khách:</span> {invoice.customer?.name}
          </p>
          <p>
            <span className="font-semibold">Kho:</span> {invoice.warehouse?.name}
          </p>
        </div>

        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-brand-200 text-left">
              <th className="py-1">SP</th>
              <th className="py-1 text-right">SL</th>
              <th className="py-1 text-right">Giá</th>
              <th className="py-1 text-right">Tiền</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id} className="border-b border-brand-100">
                <td className="py-1">{line.product.name}</td>
                <td className="py-1 text-right">{line.qty}</td>
                <td className="py-1 text-right">{money(line.unitPrice)}</td>
                <td className="py-1 text-right">{money(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
          <p className="flex justify-between">
            <span>Tạm tính</span>
            <span>{money(invoice.subtotal)} đ</span>
          </p>
          <p className="flex justify-between text-red-600">
            <span>Giảm giá</span>
            <span>-{money(invoice.discount)} đ</span>
          </p>
          <p className="flex justify-between text-lg font-bold text-brand-800">
            <span>Tổng cộng</span>
            <span>{money(invoice.total)} đ</span>
          </p>
        </div>

        <div className="mt-4 text-sm">
          <p className="font-semibold text-brand-700">Hình thức thanh toán:</p>
          {invoice.payments.map((payment) => (
            <p key={payment.id}>
              {payment.method === "CASH" ? "Tiền mặt" : payment.method === "BANK" ? "Chuyển khoản" : "Ghi nợ"}: {money(payment.amount)} đ
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};
