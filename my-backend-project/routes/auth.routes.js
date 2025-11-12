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
    const {
      identifier,
      kimlik,
      tc,
      identityNumber,
      email,
      phone,
      password,
      parola,
      sifre,
    } = req.body || {};

    const rawIdentity = (tc || kimlik || identityNumber || identifier || email || phone || '').toString().trim();
    const pass = (password || parola || sifre || '').toString();

    console.log('[LOGIN] BODY:', { rawIdentity, hasPassword: Boolean(pass) });

    if (!rawIdentity || !pass) {
      return res.status(400).json({ message: 'Kimlik ve şifre zorunlu' });
    }

    let query = {};
    if (rawIdentity.includes('@')) {
      query = { email: lc(rawIdentity) };
    } else if (/^\d{11}$/.test(rawIdentity)) {
      query = { tc: rawIdentity };
    } else if (/^\d+$/.test(rawIdentity)) {
      query = { phone: rawIdentity };
    } else {
      query = { $or: [{ email: lc(rawIdentity) }, { phone: rawIdentity }, { tc: rawIdentity }] };
    }

    const user = await User.findOne(query)
      .select('+passwordHash password active role name email tc phone serviceIds')
      .lean();

    if (!user) return res.status(401).json({ message: 'Kullanıcı bulunamadı' });

    const hashed = user.passwordHash || user.password || '';
    const ok = hashed ? await bcrypt.compare(pass, hashed) : false;
    if (!ok) return res.status(401).json({ message: 'Şifre hatalı' });

    if (user.active === false) return res.status(403).json({ message: 'Hesap pasif' });

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
    console.error('LOGIN ERR:', err);
    res.status(500).json({ message: 'Giriş sırasında hata' });
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
