const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function ensureDevAdmin() {
  try {
    const count = await User.countDocuments();
    if (count > 0) {
      console.log('[DEV ADMIN] Kullanıcı var, oluşturulmadı.');
      return;
    }

    const password = process.env.DEV_ADMIN_PASSWORD || 'Admin123!';
    const hashed = await bcrypt.hash(password, 10);

    const devAdmin = await User.create({
      name: 'Dev Admin',
      email: process.env.DEV_ADMIN_EMAIL || 'admin@local.com',
      password: hashed,
      role: 'admin',
      isApproved: true,
      active: true,
    });

    console.log('[DEV ADMIN] Oluşturuldu:', devAdmin.email);
    console.log('[DEV ADMIN] Şifre:', password);
  } catch (err) {
    console.error('[DEV ADMIN] Hatası:', err.message);
  }
}

module.exports = ensureDevAdmin;
