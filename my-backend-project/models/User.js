// models/User.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

/* =========================
   Roles / RBAC helpers
========================= */
const RoleEnum = ['user', 'staff', 'admin'];
function mapRole(v) {
  const m = String(v || '').toLowerCase();
  if (m === 'standard') return 'user';
  if (['authorized', 'authorised', 'yetkili', 'staff'].includes(m)) return 'staff';
  if (['admin', 'administrator'].includes(m)) return 'admin';
  return RoleEnum.includes(m) ? m : 'user';
}

/* =========================
   Normalization helpers
========================= */
function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

// TR odaklı telefon normalizasyonu
// Kabul edilen örnekler: 0XXXXXXXXXX, 5XXXXXXXXX, 90XXXXXXXXXX, +90XXXXXXXXXX, 0090XXXXXXXXXX
function normalizePhone(phone) {
  let digits = String(phone || '').replace(/\D+/g, '');
  if (!digits) return '';

  // 0090.... -> 90....
  if (digits.startsWith('0090')) digits = digits.slice(2); // '0090' -> '90'
  // +90 temizlenmiş hali zaten '90'
  if (digits.startsWith('90') && digits.length === 12) return digits; // 90 + 10 hane

  // 0XXXXXXXXXX -> 90 + son 10 hane
  if (digits.length === 11 && digits.startsWith('0')) {
    return '90' + digits.slice(1);
  }
  // 5XXXXXXXXX -> 90 + 10 hane
  if (digits.length === 10) {
    return '90' + digits;
  }
  // Zaten 90XXXXXXXXXX ise veya farklı ülke kodu ise olduğu gibi bırak
  return digits;
}

function normalizeTC(tc) {
  const d = String(tc || '').replace(/\D+/g, '');
  return d.length === 11 ? d : d; // 11 hane kontrolünü route tarafında yapacağız
}

function looksLikeEmail(s)  { return /@/.test(String(s)); }
function looksLikeTC(s)     { return /^\d{11}$/.test(String(s).replace(/\D+/g,'')); }
function looksLikePhone(s)  {
  const d = String(s || '').replace(/\D+/g, '');
  return d.length === 10 || (d.length === 11 && d.startsWith('0')) || (d.length === 12 && d.startsWith('90')) || d.startsWith('0090');
}

/* =========================
   Schema
========================= */
const userSchema = new mongoose.Schema({
  email: { type: String, trim: true, lowercase: true, sparse: true },
  phone: { type: String, trim: true, sparse: true },
  tc:    { type: String, trim: true, sparse: true },
  name:  { type: String, trim: true },

  role:   { type: String, enum: RoleEnum, default: 'user', set: mapRole },
  active: { type: Boolean, default: false },

  passwordHash: { type: String },
  password:     { type: String, select: false }, // yalnızca dev fallback

  inviteToken:   { type: String },
  resetToken:    { type: String },
  resetTokenExp: { type: Date },

  serviceIds:    { type: [String], default: [] },
}, { timestamps: true });

/* =========================
   Indexes
========================= */
// Not: Duplicate index uyarıları görürsen, aynı dosya iki kez load ediliyordur
// veya eski index tanımları kalmıştır. Gerekirse koleksiyondaki
// redundant index'leri bir defalık sil: db.users.dropIndex("email_1") vs.
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ tc: 1 },    { unique: true, sparse: true });
userSchema.index({ role: 1, active: 1 });
userSchema.index({ inviteToken: 1 });
userSchema.index({ resetToken: 1, resetTokenExp: 1 });

/* =========================
   Hooks
========================= */
userSchema.pre('save', function(next) {
  if (this.isModified('email') && this.email) this.email = normalizeEmail(this.email);
  if (this.isModified('phone') && this.phone) this.phone = normalizePhone(this.phone);
  if (this.isModified('tc')    && this.tc)    this.tc    = normalizeTC(this.tc);
  next();
});

/* =========================
   RBAC helpers (instance)
========================= */
userSchema.methods.isAdmin = function() { return this.role === 'admin'; };
userSchema.methods.isStaff = function() { return this.role === 'staff'; };

/* =========================
   Password helpers
========================= */
userSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(String(plain), 10);
};

userSchema.methods.comparePassword = async function (plain) {
  if (this.passwordHash) {
    try { return await bcrypt.compare(String(plain), this.passwordHash); } catch {}
  }
  // Dev ortamında düz metin fallback (prod'da kapat)
  if (process.env.NODE_ENV !== 'production' && typeof this.password === 'string') {
    return String(plain) === this.password;
  }
  return false;
};

/* =========================
   Statics
========================= */
// email / phone / tc ile tek alan üzerinden kullanıcı bulma (serbest giriş için)
userSchema.statics.findByIdentifier = async function(identifier) {
  const raw = String(identifier || '').trim();
  if (!raw) return null;

  const queries = [];

  if (looksLikeEmail(raw)) {
    queries.push({ email: normalizeEmail(raw) });
  }
  if (looksLikeTC(raw)) {
    queries.push({ tc: normalizeTC(raw) });
  }
  if (looksLikePhone(raw)) {
    const normPhone = normalizePhone(raw);
    if (normPhone) queries.push({ phone: normPhone });
  }

  // Heuristiklerin hiçbiri tutmadıysa en olası iki alanı dene
  if (queries.length === 0) {
    queries.push({ email: normalizeEmail(raw) });
    const normPhone = normalizePhone(raw);
    if (normPhone) queries.push({ phone: normPhone });
  }

  return this.findOne({ $or: queries });
};

/* =========================
   toJSON cleanup
========================= */
userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.password;
    delete ret.resetToken;
    delete ret.resetTokenExp;
    delete ret.inviteToken;
    return ret;
  }
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
