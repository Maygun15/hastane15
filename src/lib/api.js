// src/lib/api.js — axios tabanlı API istemcisi
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:10000",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
