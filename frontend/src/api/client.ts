const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

let authToken: string | null = localStorage.getItem("token");

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
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
    throw new Error(body.message || `Yêu cầu thất bại (${res.status})`);
  }

  return (await res.json()) as T;
};

export { API_BASE_URL };
