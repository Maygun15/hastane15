// src/lib/api.js — axios tabanlı API istemcisi
import axios from "axios";

const TOKEN_KEY = "authToken";
export const getToken = () => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (token) => {
  if (typeof window === "undefined") return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
};

const AUTH_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:10000/api/auth").replace(/\/$/, "");
const ROOT_BASE = AUTH_BASE.replace(/\/?api\/auth$/, "/api");

const attach = (instance) => {
  instance.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  return instance;
};

const authApi = attach(
  axios.create({ baseURL: AUTH_BASE, withCredentials: true })
);
const rootApi = attach(
  axios.create({ baseURL: ROOT_BASE, withCredentials: true })
);

export default authApi;
export const api = authApi;
export const rootApiClient = rootApi;

const stripApiPrefix = (path = "") => {
  const p = path.startsWith("/") ? path : `/${path}`;
  return p.startsWith("/api/") ? p.slice(4) : p;
};

export const apiLogin = (payload) =>
  authApi.post("/login", payload).then((res) => res.data);
export const apiRegister = (payload) =>
  authApi.post("/register", payload).then((res) => res.data);
export const apiRequestReset = (email) =>
  authApi.post("/password/request-reset", { email }).then((res) => res.data);
export const apiResetPassword = (token, password) =>
  authApi.post("/password/reset", { token, password }).then((res) => res.data);
export const apiLogout = () => authApi.post("/logout").catch(() => ({}));
export const apiHealth = () => rootApi.get("/health").then((res) => res.data);

export const API = {
  base: AUTH_BASE,
  http: {
    post: (path, body) => rootApi.post(stripApiPrefix(path), body),
  },
  setUserServices: (id, serviceIds) =>
    rootApi.post(`/users/${id}/services`, { serviceIds }),
};
