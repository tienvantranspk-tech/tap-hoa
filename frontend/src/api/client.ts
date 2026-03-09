const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

let authToken: string | null = localStorage.getItem("token");

const clearAuthState = () => {
  authToken = null;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem("token", token);
  } else {
    clearAuthState();
  }
};

export const apiRequest = async <T>(path: string, options: RequestInit = {}) => {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));

    if (res.status === 401) {
      clearAuthState();
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }

    throw new Error(
      body.message ||
        (res.status === 401
          ? "Phien dang nhap het han, vui long dang nhap lai."
          : `Yeu cau that bai (${res.status})`)
    );
  }

  return (await res.json()) as T;
};

export { API_BASE_URL };
