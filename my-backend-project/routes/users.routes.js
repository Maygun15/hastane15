// routes/users.routes.js
const express = require('express');
const router  = express.Router();

const User    = require('../models/User');
const Person  = require('../models/Person');
const { requireAuth } = require('../middleware/authz');

const XLSX = require('xlsx');
const multer = require('multer');
const upload = multer();

/* ---------------------------
   Basit alan kontrolü
---------------------------- */
function validate(b) {
  const errs = [];
  const need = (k, msg) => { if (!b[k]) errs.push(msg || `${k} gerekli`); };

  need('name', 'Ad Soyad gerekli');
  need('tc',   'TC (11 hane) gerekli');
  need('phone','Telefon gerekli');
  need('email','E-posta gerekli');
  need('serviceId','serviceId gerekli');
  need('role','role (standard/authorized/admin) gerekli');

  if (b.tc && !/^\d{11}$/.test(String(b.tc))) errs.push('TC 11 hane olmalı');
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.email))) errs.push('Geçersiz e-posta');
  return errs;
}

/* ---------------------------
   Tekli kullanıcı oluşturma
---------------------------- */
router.post('/', requireAuth, async (req, res) => {
  try {
    const me = req.user; // {_id, role, serviceIds: [...]}
    const body = req.body || {};
    const errors = validate(body);
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });

    const { name, tc, phone, email, serviceId, role, password } = body;

    // Yetki kontrolü
    const isAdmin = me.role === 'admin';
    const isStaff = me.role === 'staff';
    if (!isAdmin && !isStaff) {
      return res.status(403).json({ error: 'Yetki yok' });
    }
    if (isStaff) {
      const ok = Array.isArray(me.serviceIds) && me.serviceIds.includes(String(serviceId));
      if (!ok) return res.status(403).json({ error: 'Kendi servisin dışında kayıt açılamaz' });
    }

    // Benzersizlik ön-kontrol (yalnızca dolu alanlar)
    const or = [];
    if (email) or.push({ email: String(email).toLowerCase().trim() });
    if (phone) or.push({ phone: String(phone).trim() });
    if (tc)    or.push({ tc: String(tc).trim() });
    if (or.length) {
      const exists = await User.findOne({ $or: or }).lean();
      if (exists) return res.status(409).json({ error: 'Bu e-posta/telefon/TC zaten kayıtlı olabilir' });
    }

    const user = new User({
      email: email ? String(email).toLowerCase().trim() : null,
      phone: phone ? String(phone).trim() : null,
      tc:    tc    ? String(tc).trim()    : null,
      name,
      role,                 // 'standard'|'authorized'|'admin' → model setter mapRole ==> 'user'|'staff'|'admin'
      active: true,
      serviceIds: serviceId ? [ String(serviceId) ] : [],
    });

    const tempPassword = password || Math.random().toString(36).slice(2, 10);
    await user.setPassword(tempPassword);
    user.password = undefined;
    await user.save();

    const person = await Person.create({
      userId:    user._id,
      serviceId: String(serviceId),
      name,
      tc,
      phone,
      email: email ? String(email).toLowerCase().trim() : null,
      meta: {},
    });

    return res.json({
      ok: true,
      user: user.toJSON(),
      person,
      tempPasswordIssued: !password,
      tempPassword: !password ? tempPassword : undefined,
    });
  } catch (err) {
    if (err?.code === 11000) {
      const key = Object.keys(err.keyPattern || {})[0] || 'unique';
      return res.status(409).json({ error: `Bu ${key} zaten kullanımda` });
    }
    console.error('[POST /api/users] ERR:', err);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
});

/* ---------------------------
   EXCEL EXPORT
   GET /api/users/export.xlsx
---------------------------- */
router.get('/export.xlsx', async (_req, res) => {
  try {
    const users = await User.find({})
      .select('name email phone tc role active serviceIds')
      .lean();

    const rows = users.map(u => ({
      AdSoyad:   u.name || '',
      Email:     u.email || '',
      Telefon:   u.phone || '',
      TC:        u.tc || '',
      Rol:       u.role || 'user',          // user|staff|admin
      Aktif:     u.active ? 'Evet' : 'Hayır',
      Servisler: (u.serviceIds || []).join('|')
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Kullanicilar');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="kullanicilar.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.status(200).send(buf);
  } catch (err) {
    console.error('Export.xlsx hatası:', err);
    res.status(500).json({ message: err.message || 'Export hatası' });
  }
});

/* ---------------------------
   EXCEL IMPORT (upsert)
   POST /api/users/import.xlsx   (form-data: file)
---------------------------- */
router.post('/import.xlsx', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Excel dosyası gerekli (file)' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    const roleMap = { admin: 'admin', staff: 'staff', authorized: 'staff', standard: 'user', user: 'user' };

    let upserts = 0;
    for (const r of rows) {
      const name   = String(r.AdSoyad || '').trim();
      const email  = String(r.Email   || '').toLowerCase().trim();
      const phone  = String(r.Telefon || '').replace(/\s+/g,'').trim();
      const tc     = String(r.TC      || '').replace(/\D+/g,'').trim();
      const roleIn = String(r.Rol || 'user').toLowerCase();
      const role   = roleMap[roleIn] || 'user';
      const active = /^e(vet)?$/i.test(String(r.Aktif || 'Evet'));
      const serviceIds = String(r.Servisler || '')
        .split('|').map(s => s.trim()).filter(Boolean);

      const query = email ? { email } : (tc ? { tc } : (phone ? { phone } : null));
      if (!query) continue;

      await User.updateOne(
        query,
        {
          $set: {
            name: name || '',
            email: email || undefined,
            phone: phone || undefined,
            tc: tc || undefined,
            role,
            active,
            serviceIds
          }
        },
        { upsert: true }
      );
      upserts++;
    }

    res.json({ ok: true, upserts });
  } catch (e) {
    console.error('import.xlsx err:', e);
    res.status(400).json({ message: e.message || 'İçe aktarım hatası' });
  }
});

module.exports = router;
