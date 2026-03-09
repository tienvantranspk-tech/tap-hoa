import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@donggia.local");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/pos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form className="card w-full max-w-md space-y-5 p-8" onSubmit={onSubmit}>
        <div className="text-center">
          <p className="text-3xl font-black text-brand-500">Siêu thị đồng giá</p>
          <p className="mt-1 text-sm text-brand-700/70">Đăng nhập hệ thống POS</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-brand-800">Email</label>
          <input className="input w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-brand-800">Mật khẩu</label>
          <input
            className="input w-full"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error ? <p className="text-sm font-semibold text-red-500">{error}</p> : null}

        <button className="btn-primary w-full py-2.5" disabled={loading}>
          {loading ? "Đang xử lý..." : "Đăng nhập"}
        </button>
      </form>
    </div>
  );
};
