const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'al_kheir_feed_factory',
  user: 'postgres',
  password: ''
});

async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

async function main() {
  console.log('=== Creating employees table and seeding data ===\n');

  // Create employees table
  await query(`
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      title VARCHAR(255),
      department VARCHAR(100),
      phone VARCHAR(50),
      email VARCHAR(255),
      hire_date DATE,
      salary INTEGER,
      status VARCHAR(50) DEFAULT 'active',
      user_id INTEGER REFERENCES users(id),
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('1. Created employees table');

  // Clear existing data
  await query('DELETE FROM employees');
  await query("ALTER SEQUENCE employees_id_seq RESTART WITH 1");
  console.log('2. Cleared existing employee data');

  const employees = [
    ['ممدوح محمد عبدالصمد', 'رئيس مجلس الإدارة', 'management', null, 'owner@al-kheir.com'],
    ['عبدالرحمن ممدوح محمد عبدالصمد', 'نائب رئيس مجلس الإدارة', 'management', null, null],
    ['محمد عبد المنعم عبد الهادى', 'مدير الصيانة', 'maintenance', null, null],
    ['احمد عبد هللا محمد', 'محامي', 'legal', null, null],
    ['محمد جمال السيد علي', 'مدير الشئون القانونية', 'legal', null, null],
    ['حسن عبدالفتاح محمد عبدهللا', 'محامي', 'legal', null, null],
    ['احمد ممدوح عبد المنعم توفيق', 'رئيس محاسبين', 'finance', null, 'finance.manager@al-kheir.com'],
    ['هانى عزت محمد محمود', 'محاسب مال و HR', 'finance', null, null],
    ['احمد حمدي محمد سالم', 'محاسب فواتير مبيعات', 'finance', null, null],
    ['محمد صالح الدين محمد عبدالرحمن', 'محاسب مخازن ومشتريات', 'inventory', null, 'purchase.officer@al-kheir.com'],
    ['محمد عبد الرحمن محمد السيد', 'مسئول البوفية', 'operations', null, null],
    ['محمود السيد عبد الحميد محمد', 'طباخ', 'operations', null, null],
    ['محمود عادل محمود محمد الحته', 'مدير المبيعات', 'sales', null, 'sales.manager@al-kheir.com'],
    ['ابراهيم شعبان مصطفى', 'مندوب مبيعات', 'sales', null, 'sales.rep1@al-kheir.com'],
    ['معاذ مصطفى كمال', 'مندوب مبيعات', 'sales', null, 'sales.rep2@al-kheir.com'],
    ['محمود عبدالرحمن عنانى', 'مندوب مبيعات', 'sales', null, null],
    ['اشرف محمد احمد', 'مندوب مبيعات', 'sales', null, null],
    ['رمضان احمد عبدالهادى عبد المجيد', 'سائق', 'logistics', null, null],
    ['معتز السيد حسن محمد', 'سائق', 'logistics', null, null],
    ['عبدالرحمن السيد علي حسبوا', 'سائق', 'logistics', null, null],
    ['محمد سعيد عيد على حسن', 'سائق', 'logistics', null, null],
    ['ياسر محمد عبدالحميد', 'سائق', 'logistics', null, null],
    ['عادل على سالمة سالم', 'سائق', 'logistics', null, null],
    ['علي عبدالعزيز علي عبدالعزيز', 'سائق', 'logistics', null, null],
    ['محمد عبد هللا محمود ابراهيم', 'مدير الإنتاج', 'production', null, 'production.manager@al-kheir.com'],
    ['محمود إبراهيم محمد إبراهيم', 'مساعد مدير الإنتاج', 'production', null, null],
    ['محمد احمد محمود عثمان', 'مسئول المركزات', 'production', null, null],
    ['محمد خليل مجاهد حواش', 'مشرف صالة الإنتاج', 'production', null, null],
    ['تامر على عبد الحميد على', 'فني كنيول', 'production', null, null],
    ['عبد الرحمن محمد عبدهللا', 'فني مكبس', 'production', null, null],
    ['محمد جيالنى عبد النبى عبد العاطى', 'مشرف حركة التحميل', 'logistics', null, null],
    ['مصطفى محمود ابراهيم عبد المعطى', 'فني صيانة', 'maintenance', null, null],
    ['شريف محمد عبد هللا', 'كهربائي', 'maintenance', null, null],
    ['السيد مجدى السيد', 'مسئول المياه', 'operations', null, null],
    ['محمود السيد عبدالغني احمد العربي', 'مسئول المياه', 'operations', null, null],
    ['محمد احمد محمد يوسف الشافعي', 'مهندس ال IT', 'it', null, 'admin@al-kheir.com'],
  ];

  for (const [name, title, dept, phone, email] of employees) {
    let userId = null;
    if (email) {
      const userRes = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id;
      }
    }
    await query(
      'INSERT INTO employees (name, title, department, phone, email, user_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [name, title, dept, phone, email, userId, 'active']
    );
  }
  console.log(`3. Inserted ${employees.length} employees`);

  // Link existing users to employees
  const userLinks = [
    ['owner@al-kheir.com', 'ممدوح محمد عبدالصمد'],
    ['admin@al-kheir.com', 'محمد احمد محمد يوسف الشافعي'],
    ['sales.manager@al-kheir.com', 'محمود عادل محمود محمد الحته'],
    ['sales.rep1@al-kheir.com', 'ابراهيم شعبان مصطفى'],
    ['sales.rep2@al-kheir.com', 'معاذ مصطفى كمال'],
    ['production.manager@al-kheir.com', 'محمد عبد هللا محمود ابراهيم'],
    ['finance.manager@al-kheir.com', 'احمد ممدوح عبد المنعم توفيق'],
    ['purchase.officer@al-kheir.com', 'محمد صالح الدين محمد عبدالرحمن'],
  ];

  for (const [email, empName] of userLinks) {
    const userRes = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rows.length > 0) {
      const userId = userRes.rows[0].id;
      await query('UPDATE employees SET user_id = $1 WHERE name = $2', [userId, empName]);
    }
  }
  console.log('4. Linked users to employees');

  const count = await query('SELECT COUNT(*) FROM employees');
  console.log(`\n=== DONE: ${count.rows[0].count} employees in database ===`);

  await pool.end();
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
