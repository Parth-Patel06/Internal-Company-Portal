const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const getToken = () =>
  localStorage.getItem("tb_token");

export const setToken = (token) =>
  localStorage.setItem("tb_token", token);

export const clearToken = () =>
  localStorage.removeItem("tb_token");

export async function api(path, options = {}) {
  const token = getToken();

  let response;

  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : {}),
        ...(options.headers || {}),
      },
      body:
        options.body &&
        typeof options.body !== "string"
          ? JSON.stringify(options.body)
          : options.body,
    });
  } catch {
    throw new Error(
      "Cannot connect to the backend. Start the backend and check that it is running on port 8000."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
      data.error ||
      `Request failed (${response.status})`
    );
  }

  return data;
}
