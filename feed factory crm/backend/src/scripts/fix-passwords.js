const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

const userPasswords = [
  { email: 'owner@al-kheir.com', password: 'admin123' },
  { email: 'admin@al-kheir.com', password: 'admin123' },
  { email: 'sales.manager@al-kheir.com', password: 'manager123' },
  { email: 'sales.rep1@al-kheir.com', password: 'rep123' },
  { email: 'sales.rep2@al-kheir.com', password: 'rep123' },
  { email: 'production.manager@al-kheir.com', password: 'prod123' },
  { email: 'finance.manager@al-kheir.com', password: 'finance123' },
  { email: 'purchase.officer@al-kheir.com', password: 'purch123' },
];

(async () => {
  for (const u of userPasswords) {
    const hash = await bcrypt.hash(u.password, 10);
    const result = await query(
      "UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, email, name",
      [hash, u.email]
    );
    if (result.rows.length > 0) {
      console.log('  ' + result.rows[0].email + ' -> password set');
    }
  }
  console.log('Done. All passwords updated.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
