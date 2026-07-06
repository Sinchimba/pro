const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

export type Role = "normal" | "deaf" | "mute";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

interface AuthResponse {
  user: AuthUser;
  token: string;
}

interface ApiError {
  error: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as ApiError).error || "Something went wrong.");
  }
  return data as T;
}

export async function signup(
  name: string,
  email: string,
  password: string,
  role: Role
): Promise<AuthResponse> {
  const res = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, role }),
  });
  return handleResponse<AuthResponse>(res);
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<AuthResponse>(res);
}