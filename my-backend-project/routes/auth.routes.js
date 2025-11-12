// routes/auth.routes.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const router  = express.Router();

const path = require('path');
const User = require(path.join(__dirname, '..', 'models', 'User.js'));

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

/* ============ Helpers ============ */
const normalize = (s) => (s ?? '').toString().trim();
const lc = (s) => normalize(s).toLowerCase();
const makeToken = (uid) => jwt.sign({ uid }, JWT_SECRET, { expiresIn: '7d' });

// Frontend bazen "identifier", bazen "kimlik", bazen "tc" gönderiyor olabilir
function pickIdentifier(body) {
  return (
    normalize(body.identifier) ||
    normalize(body.kimlik) ||
    normalize(body.tc) ||
    normalize(body.email) ||
    normalize(body.phone)
  );
}

/* ============= REGISTER (opsiyonel) ============= */
router.post('/register', async (req, res) => {
  try {
    const { name, email, tc, phone, password, role } = req.body || {};
    if (!name || !password || !(email || tc || phone)) {
      return res.status(400).json({ message: 'Zorunlu alanlar eksik' });
    }

    const emailLC = email ? lc(email) : undefined;

    const exists = await User.findOne({
      $or: [
        ...(emailLC ? [{ email: emailLC }] : []),
        ...(tc      ? [{ tc }] : []),
        ...(phone   ? [{ phone }] : []),
      ],
    }).lean();

    if (exists) return res.status(409).json({ message: 'Bu kullanıcı zaten kayıtlı' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: emailLC,
      tc: tc || undefined,
      phone: phone || undefined,
      passwordHash: hash,              // 🔧 doğru alan
      role: role || 'user',
      active: true,
      serviceIds: [],
    });

    const token = makeToken(String(user._id));
    return res.json({
      token,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        tc: user.tc,
        phone: user.phone,
        role: user.role,
        active: user.active,
        serviceIds: user.serviceIds || [],
      },
    });
  } catch (err) {
    console.error('REGISTER ERR:', err);
    res.status(500).json({ message: 'Kayıt sırasında hata' });
  }
});

/* ============= LOGIN ============= */
router.post('/login', async (req, res) => {
  try {
    console.log('LOGIN BODY:', req.body);
    const {
      kimlik,
      tc,
      identityNumber,
      email,
      phone,
      parola,
      password,
      sifre,
    } = req.body || {};

    const id = (tc ?? kimlik ?? identityNumber ?? email ?? phone)?.toString().trim();
    const pass = (password ?? parola ?? sifre ?? '').toString();

    if (!id || !pass) {
      return res.status(400).json({ ok: false, msg: 'Eksik bilgi' });
    }

    let query = {};
    if (email) query = { email: lc(id) };
    else if (phone) query = { phone: id };
    else if (/^\d{11}$/.test(id)) query = { tc: id };
    else query = { username: id };

    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ ok: false, msg: 'Kullanıcı bulunamadı' });

    if (user.isApproved === false || user.active === false || user.isActive === false) {
      return res.status(403).json({ ok: false, msg: 'Hesap aktif/onaylı değil' });
    }

    const ok = await bcrypt.compare(pass, user.passwordHash || '');
    if (!ok) return res.status(401).json({ ok: false, msg: 'Şifre hatalı' });

    const token = makeToken(String(user._id));
    return res.status(200).json({
      ok: true,
      token,
      user: { id: user._id, tc: user.tc, role: user.role, name: user.name },
    });
  } catch (err) {
    console.error('LOGIN ERR:', err);
    return res.status(500).json({ ok: false, msg: 'Sunucu hatası' });
  }
});

/* ============= ME (token ile) ============= */
router.get('/me', async (req, res) => {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Yetkisiz' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.uid).lean();
    if (!user) return res.status(401).json({ message: 'Yetkisiz' });

    res.json({
      id: String(user._id),
      name: user.name,
      email: user.email,
      tc: user.tc,
      phone: user.phone,
      role: user.role,
      active: user.active,
      serviceIds: user.serviceIds || [],
    });
  } catch {
    res.status(401).json({ message: 'Yetkisiz' });
  }
});

module.exports = router;
