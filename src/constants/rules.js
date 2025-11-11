// src/constants/rules.js
// Kaynak: Parametreler → Çalışma Saatleri (Vardiya Tanımları) tablosu

/** Vardiya kodu → saat karşılığı */
export const SHIFT_HOURS = {
  M: 8,    // 08:00-16:00
  M1: 7,   // 08:00-15:00
  M2: 7,   // 09:00-16:00
  M3: 7,   // 10:00-17:00
  M4: 8,   // 16:00-00:00
  M5: 5,   // 08:00-13:00
  M6: 6,   // 08:00-14:00
  N: 24,   // 08:00-08:00
  V1: 16,  // 08:00-00:00
  V2: 24,  // 08:00-08:00
  OFF: 0,  // Boş / izinli gün
};

/**
 * İzin kuralları:
 *  - countsAsWorked: true ise “çalışılmış sayılır” ve zorunlu saatten düşülür.
 *  - hoursPerDay: o izin gününde kaç saat sayılacağı (varsayılan 8).
 *  Not: İhtiyaca göre kod ve saatleri genişletebiliriz.
 */
export const LEAVE_RULES = {
  B:  { countsAsWorked: true,  hoursPerDay: 8 }, // Babalık İzni
  D:  { countsAsWorked: true,  hoursPerDay: 8 }, // Doğum İzni
  "İ": { countsAsWorked: true,  hoursPerDay: 8 }, // Nöbet İzni

  R:  { countsAsWorked: false, hoursPerDay: 0 }, // Rapor
  Y:  { countsAsWorked: false, hoursPerDay: 0 }, // Yıllık İzin
};

/** Güvenli okuma yardımcıları (opsiyonel) */
export const getShiftHours = (code) => {
  const h = SHIFT_HOURS[code];
  return Number.isFinite(h) ? h : 0;
};
export const getLeaveCredit = (code) => {
  const r = LEAVE_RULES[code];
  if (!r || !r.countsAsWorked) return 0;
  return Number.isFinite(r.hoursPerDay) ? r.hoursPerDay : 8;
};
