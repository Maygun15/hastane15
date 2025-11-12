// src/tabs/UsersTab.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getUsers, saveUsers } from "../models/userModel.js";
import {
  setUserRole as lsSetUserRole,
  setUserStatus as lsSetUserStatus,
  setUserServices as lsSetUserServices,
  activateByIdentifier as lsActivateByIdentifier,
} from "../auth/userAuth.js";
import useServicesModel from "../hooks/useServicesModel.js";
import api, { getToken } from "../lib/api.js";

/* ---------------- küçük yardımcılar ---------------- */
function Badge({ children, tone = "slate" }) {
  const cls = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-rose-100 text-rose-700",
  }[tone] || "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${cls}`}>
      {children}
    </span>
  );
}

/* ---------------- Servis atama modali (hook sırası SABİT) ---------------- */
function AssignServicesModal({ open, initialIds = [], onClose, onSave }) {
  const m = useServicesModel();
  const [sel, setSel] = useState(() => new Set((initialIds || []).map(String)));
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const all = m.list?.() || [];
    const s = q.trim().toLowerCase();
    let rows = all;
    if (s) {
      rows = rows.filter(
        (r) =>
          String(r.name || "").toLowerCase().includes(s) ||
          String(r.code || "").toLowerCase().includes(s)
      );
    }
    return [...rows].sort(
      (a, b) => Number(b.active) - Number(a.active) || (a.name || "").localeCompare(b.name || "")
    );
  }, [m, q]);

  useEffect(() => {
    if (open) {
      setSel(new Set((initialIds || []).map(String)));
      setQ("");
    }
  }, [open, initialIds]);

  if (!open) return null;

  const toggle = (id) => {
    const k = String(id);
    const next = new Set(sel);
    next.has(k) ? next.delete(k) : next.add(k);
    setSel(next);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="font-semibold">Servis ata</div>
          <input
            className="h-9 rounded-lg border px-3 text-sm"
            placeholder="Ara (ad/kod)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="max-h-[52vh] overflow-auto p-2">
          {list.length === 0 ? (
            <div className="p-4 text-sm text-slate-600">Servis bulunamadı.</div>
          ) : (
            <ul className="divide-y">
              {list.map((s) => {
                const id = String(s.id ?? s._id ?? s.code ?? s.name);
                const checked = sel.has(id);
                return (
                  <li key={id} className="flex items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={checked}
                      onChange={() => toggle(id)}
                    />
                    <div className="flex-1">
                      <div className="text-[13px] font-medium">{s.name || s.code}</div>
                      <div className="text-[11px] text-slate-500">{s.code}</div>
                    </div>
                    <Badge tone={s.active ? "green" : "slate"}>{s.active ? "aktif" : "pasif"}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <button className="px-3 h-9 rounded-lg border" onClick={onClose}>İptal</button>
          <button
            className="px-4 h-9 rounded-lg bg-sky-600 text-white hover:bg-sky-700"
            onClick={() => onSave(Array.from(sel))}
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Kullanıcılar sekmesi ---------------- */
export default function UsersTab() {
  const [list, setList] = useState(() => getUsers()); // LS fallback kaynağı
  const [q, setQ] = useState("");
  const [assignFor, setAssignFor] = useState(null);

  const servicesModel = useServicesModel();
  const servicesById = useMemo(() => {
    const map = new Map();
    (servicesModel.list?.() || []).forEach((s) => {
      map.set(String(s.id ?? s._id ?? s.code ?? s.name), s);
    });
    return map;
  }, [servicesModel]);

  useEffect(() => {
    const onStorage = () => setList(getUsers());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    let L = list || [];
    if (s) {
      L = L.filter((u) => {
        const K = [u.name, u.email, u.phone, u.tc, u.role, u.status]
          .map((v) => String(v || "").toLowerCase());
        return K.some((x) => x.includes(s));
      });
    }
    return L;
  }, [list, q]);

  const refresh = () => setList(getUsers());

  const roleBadge = (role) => {
    const r = String(role || "").toUpperCase();
    if (r === "ADMIN") return <Badge tone="red">ADMIN</Badge>;
    if (r === "AUTHORIZED" || r === "STAFF") return <Badge tone="amber">{r}</Badge>;
    return <Badge>STANDARD</Badge>;
  };

  const formatServiceNames = (ids = []) => {
    const arr = Array.isArray(ids) ? ids : [];
    const names = arr
      .map((id) => {
        const s = servicesById.get(String(id));
        if (!s) return null;
        return (s.name || s.code || "").trim() || null;
      })
      .filter(Boolean);
    return names.length ? names.join(", ") : "-";
  };

  const hasBackend = !!getToken();

  // ✅ DÜZELTİLEN FONKSİYON
  const handleActivate = async (u) => {
    if (!hasBackend) {
      // Backend yoksa LS’de aktifleştir
      lsActivateByIdentifier(u.email || u.tc || u.phone || u.name);
      lsSetUserStatus(u.id, "active");
      refresh();
      return;
    }

    // ID belirleme ve doğrulama
    const userId = String(u._id || u.id || "");
    if (userId.length !== 24) {
      // Geçersiz veya LS kaydı → LS fallback
      lsActivateByIdentifier(u.email || u.tc || u.phone || u.name);
      lsSetUserStatus(u.id, "active");
      refresh();
      return;
    }

    // Doğru endpoint: /api/users/:id/activate
    try {
      await api.post(`../users/${userId}/activate`);
      // UI LS kaynağıyla senkron
      lsSetUserStatus(u.id, "active");
      refresh();
    } catch (e) {
      alert(e?.message || "Aktifleştirme başarısız");
    }
  };

  const handleSetRole = (u, role) => {
    lsSetUserRole(u.id, role);
    refresh();
  };

  const handleSuspend = (u) => {
    lsSetUserStatus(u.id, "pending");
    refresh();
  };

  return (
    <div className="space-y-4">
      {/* arama */}
      <div className="flex items-center gap-2">
        <input
          className="h-10 px-3 rounded-lg border w-80"
          placeholder="Ara: ad / tc / tel / mail / rol / durum"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="h-10 px-3 rounded-lg border" onClick={refresh}>
          Yenile
        </button>
      </div>

      {rows.length === 0 && (
        <div className="p-4 border rounded-xl text-sm text-slate-600">
          Kayıt bulunamadı.
        </div>
      )}

      {/* kartlar */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((u) => {
          const userId = u.id || u._id;
          const currentServiceIds = (Array.isArray(u.serviceIds) ? u.serviceIds : u.services) || [];

          return (
            <div key={userId} className="rounded-xl border bg-white shadow-sm p-3">
              <div className="flex items-start justify-between">
                <div className="font-semibold text-[14px]">{u.name || "-"}</div>
                <Badge tone={u.status === "active" ? "green" : u.status === "pending" ? "amber" : "slate"}>
                  {u.status || (u.active === false ? "pending" : "active")}
                </Badge>
              </div>

              <div className="mt-2 text-[12px] space-y-1">
                <div>TC: {u.tc || "-"}</div>
                <div>Tel: {u.phone || "-"}</div>
                <div>Mail: {u.email || "-"}</div>
                <div>Rol: {roleBadge(u.role)}</div>
                <div>Servisler: {formatServiceNames(currentServiceIds)}</div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {u.status !== "active" ? (
                  <button
                    className="text-[12px] px-3 py-1 rounded bg-emerald-600 text-white"
                    onClick={() => handleActivate(u)}
                  >
                    Aktifleştir
                  </button>
                ) : (
                  <button
                    className="text-[12px] px-3 py-1 rounded border"
                    onClick={() => handleSuspend(u)}
                  >
                    Askıya al
                  </button>
                )}

                <button
                  className="text-[12px] px-3 py-1 rounded border"
                  onClick={() => { handleSetRole(u, "ADMIN"); }}
                >
                  Admin yap
                </button>
                <button
                  className="text-[12px] px-3 py-1 rounded border"
                  onClick={() => { handleSetRole(u, "AUTHORIZED"); }}
                >
                  Yetkili yap
                </button>
                <button
                  className="text-[12px] px-3 py-1 rounded border"
                  onClick={() => { handleSetRole(u, "STANDARD"); }}
                >
                  Standart yap
                </button>

                <button
                  className="text-[12px] px-3 py-1 rounded border"
                  onClick={() =>
                    setAssignFor({
                      id: userId,
                      name: u.name || u.email || u.tc,
                      services: currentServiceIds.map(String),
                    })
                  }
                >
                  Servis ata
                </button>

                <button
                  className="text-[12px] px-3 py-1 rounded border text-red-600"
                  onClick={() => {
                    if (confirm(`"${u.name || u.email}" silinsin mi?`)) {
                      const rest = (getUsers() || []).filter((x) => (x.id || x._id) !== userId);
                      saveUsers(rest);
                      refresh();
                    }
                  }}
                >
                  Sil
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <AssignServicesModal
        open={Boolean(assignFor)}
        initialIds={assignFor?.services || []}
        onClose={() => setAssignFor(null)}
        onSave={async (ids) => {
          try {
            if (hasBackend) {
              await api.post(`../users/${assignFor.id}/services`, { serviceIds: ids });
            } else {
              lsSetUserServices(assignFor.id, ids);
            }
            setAssignFor(null);
            refresh();
          } catch (e) {
            alert(e.message || "Kaydedilemedi");
          }
        }}
      />
    </div>
  );
}
