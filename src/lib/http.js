import axios from "axios";

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, // .env: VITE_API_BASE=https://hastane-backend.onrender.com
  headers: { "Content-Type": "application/json" },
});
