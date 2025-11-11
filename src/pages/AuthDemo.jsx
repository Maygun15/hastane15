// src/pages/AuthDemo.jsx
import React, { useMemo, useState } from "react";
import { apiLogin, apiRegister, setToken } from "../lib/api.js";

/** Yardımcı normalizasyonlar */
const normTC = (v) => String(v || "").replace(/\D+/g, "").slice(0, 11);
const normPhone = (v) => {
  let d = String(v || "").replace(/\D+/g, "");
  if (d.startsWith("0090")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) return "90" + d.slice(1);
  if (d.length === 10) return "90" + d;
  return d;
};
const looksLikeEmail = (s) => /@/.test(String(s || ""));

function normalizeIdentifier(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (looksLikeEmail(s)) return s.toLowerCase();
  const only = s.replace(/\D+/g, "");
  if (only.length === 11) return only;       // TC
  return normPhone(only);                     // Telefonu 90... yap
}

export default function AuthDemo() {
  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // login
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // register
  const [name, setName] = useState("");
  const [tc, setTc] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [rpass, setRpass] = useState("");

  const identNorm = useMemo(() => normalizeIdentifier(identifier), [identifier]);
  const tcNorm = useMemo(() => normTC(tc), [tc]);
  const phoneNorm = useMemo(() => normPhone(phone), [phone]);

  async function handleLogin(e) {
    e.preventDefault();
    if (loading) return;
    setMsg("");
    setLoading(true);
    try {
      const { token } = await apiLogin({ identifier: identNorm, password });
      if (token) setToken(token);
      setMsg("Giriş başarılı, yönlendiriliyor…");
      setTimeout(() => (window.location.href = "/"), 400);
    } catch (err) {
      setMsg(err.message || "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (loading) return;
    setMsg("");
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        tc: tcNorm,
        phone: phoneNorm,
        email: email.trim().toLowerCase(),
        password: rpass,
      };
      const { token } = await apiRegister(payload);
      if (token) setToken(token);
      setMsg("Kayıt başarılı, giriş yapıldı.");
      setTimeout(() => (window.location.href = "/"), 600);
    } catch (err) {
      setMsg(err.message || "Kayıt başarısız");
    } finally {
      setLoading(false);
    }
  }

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-400";
  const btn =
    "w-full rounded-lg px-4 py-2 font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60";
  const disabledLogin = loading || !identNorm || (password || "").length < 1;
  const disabledReg =
    loading ||
    !name.trim() ||
    tcNorm.length !== 11 ||
    phoneNorm.length < 12 ||
    !email.trim() ||
    (rpass || "").length < 6;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-6">
        <div className="text-center mb-4">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            Hastane Nöbet Sistemi
          </span>
          <h1 className="text-xl font-semibold mt-2">
            {tab === "login" ? "Giriş yap" : "Hesap oluştur"}
          </h1>
          <p className="text-slate-500 text-sm">
            {tab === "login"
              ? "TC / Telefon / E-posta ile giriş yapın"
              : "Ad Soyad, TC, Telefon, E-posta ile kayıt olun"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 mb-4 bg-slate-100 p-1 rounded-xl">
          <button
            className={`rounded-lg py-2 text-sm ${
              tab === "login" ? "bg-white shadow font-medium" : ""
            }`}
            onClick={() => setTab("login")}
          >
            Giriş
          </button>
          <button
            className={`rounded-lg py-2 text-sm ${
              tab === "register" ? "bg-white shadow font-medium" : ""
            }`}
            onClick={() => setTab("register")}
          >
            Kayıt Ol
          </button>
        </div>

        {tab === "login" ? (
          <form className="space-y-3" onSubmit={handleLogin}>
            <input
              className={input}
              placeholder="TC / Telefon / E-posta"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
            />
            <input
              className={input}
              type="password"
              placeholder="Parola"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button className={btn} disabled={disabledLogin}>
              {loading ? "Gönderiliyor…" : "Giriş Yap"}
            </button>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={handleRegister}>
            <input
              className={input}
              placeholder="Ad Soyad"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className={input}
              placeholder="TC (11 hane)"
              value={tc}
              onChange={(e) => setTc(e.target.value)}
              required
              inputMode="numeric"
            />
            <input
              className={input}
              placeholder="Telefon (5XXXXXXXXX / 0XXXXXXXXXX)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              inputMode="tel"
            />
            <input
              className={input}
              placeholder="E-posta"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className={input}
              type="password"
              placeholder="Parola (min 6)"
              value={rpass}
              onChange={(e) => setRpass(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <button className={btn} disabled={disabledReg}>
              {loading ? "Gönderiliyor…" : "Kayıt Ol"}
            </button>
          </form>
        )}

        {!!msg && (
          <div className="mt-4 text-center text-sm text-slate-700">{msg}</div>
        )}
      </div>
    </div>
  );
}
