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
  console.log('=== Al Kheir Feed Factory - Comprehensive Data Seed ===\n');

  // ============================================
  // STEP 1: Clear old seed data (keep schema, keep users)
  // ============================================
  console.log('1. Clearing old reference data...');
  // Delete in dependency order (children first)
  await query('DELETE FROM feed_recipe_items');
  await query('DELETE FROM feed_recipes');
  await query('DELETE FROM feed_pricing');
  await query('DELETE FROM sales_order_items');
  await query('DELETE FROM invoice_items');
  // payments table does not exist in schema
  await query('DELETE FROM reminders');
  await query('DELETE FROM sales_orders');
  await query('DELETE FROM invoices');
  await query('DELETE FROM client_payment_history');
  await query('DELETE FROM client_expected_payments');
  await query('DELETE FROM client_liabilities');
  await query('DELETE FROM clients');
  await query('DELETE FROM production_order_items');
  await query('DELETE FROM production_orders');
  await query('DELETE FROM inventory_transactions');
  await query('DELETE FROM feed_types');
  await query('DELETE FROM raw_materials');
  await query('DELETE FROM suppliers');
  
  // Reset sequences
  await query("ALTER SEQUENCE feed_types_id_seq RESTART WITH 1");
  await query("ALTER SEQUENCE raw_materials_id_seq RESTART WITH 1");
  await query("ALTER SEQUENCE clients_id_seq RESTART WITH 1");
  await query("ALTER SEQUENCE feed_recipes_id_seq RESTART WITH 1");
  await query("ALTER SEQUENCE suppliers_id_seq RESTART WITH 1");
  await query("ALTER SEQUENCE sales_orders_id_seq RESTART WITH 1");
  await query("ALTER SEQUENCE invoices_id_seq RESTART WITH 1");
  await query("ALTER SEQUENCE reminders_id_seq RESTART WITH 1");
  console.log('   Done.\n');

  // ============================================
  // STEP 2: Users - Update with real employee names
  // ============================================
  console.log('2. Updating users with real employee data...');
  const userUpdates = [
    ['owner@al-kheir.com', 'محمود محمد عبدالصمد', 'رئيس مجلس الإدارة'],
    ['admin@al-kheir.com', 'محمد أحمد محمد يوسف الشافعي', 'مدير تقنية المعلومات'],
    ['sales.manager@al-kheir.com', 'محمد عادل محمد محمود لحته', 'مدير المبيعات'],
    ['sales.rep1@al-kheir.com', 'إبراهيم شعبان مصطفى', 'مندوب مبيعات'],
    ['sales.rep2@al-kheir.com', 'معاذ مصطفى كامل', 'مندوب مبيعات'],
    ['production.manager@al-kheir.com', 'محمد عبدالله محمود إبراهيم', 'مدير الإنتاج'],
    ['finance.manager@al-kheir.com', 'أحمد محمود عبدالمنعم توفيق', 'رئيس حسابات'],
    ['purchase.officer@al-kheir.com', 'محمد صلاح الدين محمد عبدالرحمن', 'محاسب مخازن ومشتريات'],
  ];
  for (const [email, name, dept] of userUpdates) {
    await query('UPDATE users SET name = $1, department = $2 WHERE email = $3', [name, dept, email]);
  }
  console.log('   Done.\n');

  // ============================================
  // STEP 3: FEED TYPES (23 types - from pricing JSON)
  // ============================================
  console.log('3. Inserting feed types...');
  const feedTypes = [
    ['FT001', 'علف سوبر بادى 23%', 'Super Starter Feed 23%', '23%', 'poultry', 'starter'],
    ['FT002', 'علف سوبر نامى 21%', 'Super Grower Feed 21%', '21%', 'poultry', 'grower'],
    ['FT003', 'علف سوبر ناهى 19%', 'Super Finisher Feed 19%', '19%', 'poultry', 'finisher'],
    ['FT004', 'علف بادى نامى 21%', 'Broiler Starter-Grower Feed 21%', '21%', 'poultry', 'broiler_starter_grower'],
    ['FT005', 'علف بادى بياض 20%', 'Layer Starter Feed 20%', '20%', 'poultry', 'layer_starter'],
    ['FT006', 'علف نامى 1 بياض 18%', 'Layer Grower Feed 1 (18%)', '18%', 'poultry', 'layer_grower1'],
    ['FT007', 'علف نامى 2 بياض 16%', 'Layer Grower Feed 2 (16%)', '16%', 'poultry', 'layer_grower2'],
    ['FT008', 'علف بياض تحضيرى 17.5%', 'Layer Pre-Lay Feed 17.5%', '17.5%', 'poultry', 'layer_prelay'],
    ['FT009', 'علف بياض انتاجى 18%', 'Layer Production Feed 18%', '18%', 'poultry', 'layer_production_18'],
    ['FT010', 'علف بياض انتاجى 17%', 'Layer Production Feed 17%', '17%', 'poultry', 'layer_production_17'],
    ['FT011', 'علف بياض انتاجى 16%', 'Layer Production Feed 16%', '16%', 'poultry', 'layer_production_16'],
    ['FT012', 'علف بياض انتاجى 14%', 'Layer Production Feed 14%', '14%', 'poultry', 'layer_production_14'],
    ['FT013', 'علف بادى بط 22%', 'Duck Starter Feed 22%', '22%', 'poultry', 'duck_starter'],
    ['FT014', 'علف نامى بط 18%', 'Duck Grower Feed 18%', '18%', 'poultry', 'duck_grower'],
    ['FT015', 'علف بادى نامى منزلى 21%', 'Home Broiler Feed 21%', '21%', 'poultry', 'home_broiler'],
    ['FT016', 'علف سوبر بادى 24%', 'Super Starter Feed 24%', '24%', 'poultry', 'starter_24'],
    ['FT017', 'علف جاموسي 16%', 'Buffalo Feed 16%', '16%', 'cattle', 'buffalo'],
    ['FT018', 'علف جاموسي 14%', 'Buffalo Feed 14%', '14%', 'cattle', 'buffalo_light'],
    ['FT019', 'علف بقري 16%', 'Cattle Feed 16%', '16%', 'cattle', 'cattle'],
    ['FT020', 'علف بقري 14%', 'Cattle Feed 14%', '14%', 'cattle', 'cattle_light'],
    ['FT021', 'علف تسمين 12%', 'Fattening Feed 12%', '12%', 'cattle', 'fattening'],
    ['FT022', 'علف أغنام 16%', 'Sheep Feed 16%', '16%', 'cattle', 'sheep'],
    ['FT023', 'علف أغنام 14%', 'Sheep Feed 14%', '14%', 'cattle', 'sheep_light'],
  ];
  for (const ft of feedTypes) {
    await query(
      'INSERT INTO feed_types (code, name_arabic, name_english, protein_percentage, category, sub_category) VALUES ($1,$2,$3,$4,$5,$6)',
      ft
    );
  }
  console.log(`   Inserted ${feedTypes.length} feed types.\n`);

  // ============================================
  // STEP 4: FEED PRICING (23 types × 3 sizes = 69 records)
  // ============================================
  console.log('4. Inserting feed pricing...');
  const pricingData = [
    // [feed_type_id, size, cost, sp7, sp75, sp8, max]
    // FT001 - Super Starter 23%
    [1, 10, 193196, 206720, 207690, 212210, 214210],
    [1, 25, 482991, 516800, 519225, 530525, 535525],
    [1, 50, 965981, 1033600, 1038450, 1061050, 1071050],
    // FT002 - Super Grower 21%
    [2, 10, 191290, 204680, 205640, 210440, 212440],
    [2, 25, 478224, 511700, 514100, 526100, 531100],
    [2, 50, 956449, 1023400, 1028200, 1052200, 1062200],
    // FT003 - Super Finisher 19%
    [3, 10, 187551, 200680, 201620, 206690, 208690],
    [3, 25, 468879, 501700, 504050, 516725, 521725],
    [3, 50, 937757, 1003400, 1008100, 1033450, 1043450],
    // FT004 - Broiler 21%
    [4, 10, 181421, 194120, 195030, 199250, 201250],
    [4, 25, 453552, 485300, 487575, 498125, 503125],
    [4, 50, 907103, 970600, 975150, 996250, 1006250],
    // FT005 - Layer Starter 20%
    [5, 10, 182187, 194940, 195850, 200240, 202240],
    [5, 25, 455467, 487350, 489625, 500600, 505600],
    [5, 50, 910935, 974700, 979250, 1001200, 1011200],
    // FT006 - Layer Grower 1 18%
    [6, 10, 175234, 187500, 188370, 192770, 194770],
    [6, 25, 438084, 468750, 470925, 481925, 486925],
    [6, 50, 876168, 937500, 941850, 963850, 973850],
    // FT007 - Layer Grower 2 16%
    [7, 10, 165514, 177100, 177930, 182400, 184400],
    [7, 25, 413785, 442750, 444825, 456000, 461000],
    [7, 50, 827570, 885500, 889650, 912000, 922000],
    // FT008 - Layer Pre-Lay 17.5%
    [8, 10, 160280, 171500, 180920, 185340, 187340],
    [8, 25, 400700, 428750, 452300, 463350, 468350],
    [8, 50, 801401, 857500, 904600, 926700, 936700],
    // FT009 - Layer Production 18%
    [9, 10, 155607, 166500, 178210, 182390, 184390],
    [9, 25, 389019, 416250, 445525, 455975, 460975],
    [9, 50, 778037, 832500, 891050, 911950, 921950],
    // FT010 - Layer Production 17%
    [10, 10, 153738, 164500, 176080, 180380, 182380],
    [10, 25, 384346, 411250, 440200, 450950, 455950],
    [10, 50, 768692, 822500, 880400, 901900, 911900],
    // FT011 - Layer Production 16%
    [11, 10, 151869, 162500, 171630, 175940, 177940],
    [11, 25, 379673, 406250, 429075, 439850, 444850],
    [11, 50, 759346, 812500, 858150, 879700, 889700],
    // FT012 - Layer Production 14%
    [12, 10, 152150, 162800, 163560, 167890, 169890],
    [12, 25, 380374, 407000, 408900, 419725, 424725],
    [12, 50, 760748, 814000, 817800, 839450, 849450],
    // FT013 - Duck Starter 22%
    [13, 10, 185271, 198240, 199170, 203730, 205730],
    [13, 25, 463177, 495600, 497925, 509325, 514325],
    [13, 50, 926355, 991200, 995850, 1018650, 1028650],
    // FT014 - Duck Grower 18%
    [14, 10, 180944, 193610, 194510, 199470, 201470],
    [14, 25, 452360, 484025, 486275, 498675, 503675],
    [14, 50, 904720, 968050, 972550, 997350, 1007350],
    // FT015 - Home Broiler 21%
    [15, 10, 176420, 188770, 189650, 193880, 195880],
    [15, 25, 441051, 471925, 474125, 484700, 489700],
    [15, 50, 882102, 943850, 948250, 969400, 979400],
    // FT016 - Super Starter 24%
    [16, 10, 190122, 203430, 204380, 208750, 210750],
    [16, 25, 475306, 508575, 510950, 521875, 526875],
    [16, 50, 950612, 1017150, 1021900, 1043750, 1053750],
    // FT017 - Buffalo 16%
    [17, 10, 140000, 149800, 150500, 151200, 154000],
    [17, 25, 350000, 374500, 376250, 378000, 385000],
    [17, 50, 700000, 749000, 752500, 756000, 770000],
    // FT018 - Buffalo 14%
    [18, 10, 135000, 144450, 145125, 145800, 148500],
    [18, 25, 337500, 361125, 362812, 364500, 371250],
    [18, 50, 675000, 722250, 725625, 729000, 742500],
    // FT019 - Cattle 16%
    [19, 10, 142000, 151940, 152650, 153360, 156200],
    [19, 25, 355000, 379850, 381625, 383400, 390500],
    [19, 50, 710000, 759700, 765250, 766800, 781000],
    // FT020 - Cattle 14%
    [20, 10, 137000, 146590, 147275, 147960, 150700],
    [20, 25, 342500, 366475, 368187, 369900, 376750],
    [20, 50, 685000, 732950, 736375, 739800, 753500],
    // FT021 - Fattening 12%
    [21, 10, 130000, 139100, 139750, 140400, 143000],
    [21, 25, 325000, 347750, 349375, 351000, 357500],
    [21, 50, 650000, 695500, 698750, 702000, 715000],
    // FT022 - Sheep 16%
    [22, 10, 145000, 155150, 155875, 156600, 159500],
    [22, 25, 362500, 387875, 389687, 391500, 398750],
    [22, 50, 725000, 775750, 779375, 783000, 797500],
    // FT023 - Sheep 14%
    [23, 10, 138000, 147660, 148350, 149040, 151800],
    [23, 25, 345000, 369150, 370875, 372600, 379500],
    [23, 50, 690000, 738300, 741750, 745200, 759000],
  ];
  for (const p of pricingData) {
    await query(
      'INSERT INTO feed_pricing (feed_type_id, package_size, cost_price, selling_price_7, selling_price_75, selling_price_8, max_price) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      p
    );
  }
  console.log(`   Inserted ${pricingData.length} pricing records.\n`);

  // ============================================
  // STEP 5: RAW MATERIALS (from inventory XLSX + pricing JSON)
  // ============================================
  console.log('5. Inserting raw materials with real stock...');
  const rawMaterials = [
    // [code, name_ar, name_en, category, unit_price, current_stock, min_stock, reorder]
    ['RM001', 'جلوتين', 'Gluten', 'protein', 38.50, 1265, 100, 300],
    ['RM002', 'ذره', 'Corn', 'grain', 15.00, 139069, 5000, 15000],
    ['RM003', 'رجيع أرز', 'Rice Bran', 'grain', 10.50, 5452, 500, 1500],
    ['RM004', 'رده', 'Wheat Bran', 'grain', 10.80, 27571, 2000, 5000],
    ['RM005', 'سن (رده)', 'Chaff/Bran', 'fiber', 12.00, 5567, 500, 1500],
    ['RM006', 'صويا 46', 'Soybean 46%', 'protein', 19.35, 29219, 3000, 8000],
    ['RM007', 'فيلكس (سائل)', 'Felix (Liquid)', 'additive', 45.00, 189, 20, 50],
    ['RM008', 'اكتى داى كوكس (دايكلازوريل)', 'Active Day Cox (Diclazuril)', 'medication', 90.00, 590, 50, 100],
    ['RM009', 'اميونو اند', 'Immuno End', 'additive', 120.00, 363, 30, 80],
    ['RM010', 'اندسورب', 'Adsorbent', 'additive', 20.00, 927, 80, 200],
    ['RM011', 'بريمكس', 'Premix', 'additive', 112.00, 894, 80, 200],
    ['RM012', 'بكس ليزو (مستحلب دهني)', 'Bex Lyso (Fat Emulsifier)', 'additive', 290.00, 272, 25, 60],
    ['RM013', 'بيتافين s4', 'Betafin S4', 'additive', 75.00, 297, 25, 60],
    ['RM014', 'بيرفورما 70', 'Performa 70', 'additive', 200.00, 1058, 50, 150],
    ['RM015', 'بيكربونات صوديوم', 'Sodium Bicarbonate', 'additive', 26.00, 959, 80, 200],
    ['RM016', 'ثريونين', 'Threonine', 'additive', 95.00, 1535, 50, 150],
    ['RM017', 'حجر جيرى', 'Limestone', 'mineral', 0.60, 33853, 3000, 8000],
    ['RM018', 'فوس 10000 (فيتيز)', 'Phytase 10000', 'enzyme', 660.00, 0.075, 5, 15],
    ['RM019', 'كولين كلوريد', 'Choline Chloride', 'additive', 55.00, 597, 50, 120],
    ['RM020', 'لايسين', 'Lysine', 'additive', 100.00, 1738, 100, 300],
    ['RM021', 'ملح طعام - ناعم', 'Fine Salt', 'mineral', 1.85, 2934, 300, 800],
    ['RM022', 'مونو كالسيوم (احادى كالسيوم فوسفات)', 'Mono Calcium Phosphate', 'mineral', 34.25, 2661, 200, 500],
    ['RM023', 'ميثونين', 'Methionine', 'additive', 150.00, 495, 50, 150],
    ['RM024', 'نيوتريليز x (انزيم طاقه)', 'Nutralize X (Energy Enzyme)', 'enzyme', 200.00, 404, 30, 80],
    ['RM025', 'شكاير', 'Bags/Sacks', 'packaging', 13.00, 10000, 1000, 3000],
  ];
  for (const rm of rawMaterials) {
    await query(
      'INSERT INTO raw_materials (code, name_arabic, name_english, category, unit_price, current_stock, min_stock_level, reorder_level) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      rm
    );
  }
  console.log(`   Inserted ${rawMaterials.length} raw materials.\n`);

  // ============================================
  // STEP 6: SUPPLIERS (from الموردين.xlsx)
  // ============================================
  console.log('6. Inserting suppliers...');
  const suppliers = [
    ['SUP-001', 'الحاج / ابراهيم النادى', 'الحاج/ابراهيم النادى', '01001170076', null, ['RM002', 'RM006'], 'آجل', 4],
    ['SUP-002', 'الشركة الإيطاليه', 'م. أيمن نوفل', '01009031212', null, ['RM002', 'RM006'], 'آجل', 4],
    ['SUP-003', 'الحاج علي اللويزي', 'على اللويزى', '01116993656', null, ['RM002'], 'آجل', 3],
    ['SUP-004', 'ابو حري', 'الحاج / يسرى ابوحري', '01222475072', null, ['RM002', 'RM006'], 'نقداً', 4],
    ['SUP-005', 'مؤسسة النجوم ( عماد حسنى )', 'الحاج/ عماد حسنى', '01147722100', null, ['RM002', 'RM006'], 'آجل', 4],
    ['SUP-006', 'الحاج / صبحي معروف', 'أ.إبراهيم صبحي معروف', '01063244245', null, ['RM002', 'RM006'], 'آجل', 3],
    ['SUP-007', 'المنيرى لمنتجات الذرة', 'أ.حمادة إمام', '01099590055', null, ['RM001'], 'نقداً', 5],
    ['SUP-008', 'الوطنية لمنتجات النشا والجلوكوز', 'د/ أحمد رمضان', '01203307342', null, ['RM001'], 'نقداً', 4],
    ['SUP-009', 'أولاد حفني - أبو حماد', 'أ. أحمد حفني', '01005083670', null, ['RM001'], 'نقداً', 4],
    ['SUP-010', 'المجد للخامات', 'اسلام', '01068573336', null, ['RM004'], 'نقداً', 3],
    ['SUP-011', 'الشنيطى - مورد رده وسن', 'م. محمد الشنيطي', '01225400333', null, ['RM004', 'RM005'], 'آجل', 4],
    ['SUP-012', 'مطحن جولدن جروب', 'ا / هانى', '01222552255', null, ['RM004', 'RM005'], 'نقداً', 4],
    ['SUP-013', 'د. حسن دراز', null, '01113403514', null, ['RM017'], 'نقداً', 3],
    ['SUP-014', 'شركة منيا جلوب', 'م. محمود', '01119958331', null, ['RM017'], 'آجل', 4],
    ['SUP-015', 'بيوفيد انترناشيونال', 'د. حامد بكر', '01002710295', null, ['RM022'], 'آجل', 4],
    ['SUP-016', 'ايجافيت', 'د/ محمد شعلان', '01223276777', null, ['RM022'], 'آجل', 4],
    ['SUP-017', 'فارما كير', 'أ.كرلس طلعت', '01026194710', null, ['RM022', 'RM015', 'RM020'], 'آجل', 4],
    ['SUP-018', 'كيروفيست', 'د. ريمون / أ.ماجد نبيل', '01097609619', null, ['RM013', 'RM018'], 'آجل', 4],
    ['SUP-019', 'مالتى فيتا', 'م / احمد عيسى', '01119799332', null, ['RM011', 'RM013'], 'آجل', 4],
    ['SUP-020', 'فاميلي سولت', 'أ. إبراهيم', '01014885523', null, ['RM021'], 'نقداً', 4],
    ['SUP-021', 'ميراسكو', 'د / هيثم', '01205404552', null, ['RM015'], 'آجل', 3],
    ['SUP-022', 'البراق', 'د/طارق الشايب', '01272699199', null, ['RM020'], 'آجل', 3],
    ['SUP-023', 'العفت تريدينج', 'د/ريمون', '01289601222', null, ['RM016', 'RM020'], 'آجل', 4],
    ['SUP-024', 'انتر فارما', 'د. أحمد الهادى', '01003361644', null, ['RM020'], 'آجل', 4],
    ['SUP-025', 'شركة الصفوه', 'م. محمد المقدم', '01006307132', null, ['RM020'], 'آجل', 3],
    ['SUP-026', 'يونايتد بيوميد', 'م / محمد ممدوح', '01003823677', null, ['RM012'], 'آجل', 4],
    ['SUP-027', 'روفيلد نيوتريشن', 'د/ احمد عبدالعظيم', '01005570671', null, ['RM008'], 'آجل', 4],
    ['SUP-028', 'ايفي بروتكت', 'د / شريف منصور', '01278719777', null, ['RM008', 'RM010'], 'آجل', 4],
    ['SUP-029', 'فاميكس', 'د / محمد النجدى', '01066620948', null, ['RM018'], 'آجل', 4],
    ['SUP-030', 'شركة فيلو', 'أ. زكريا العبد', '01050859487', null, ['RM025'], 'آجل', 4],
  ];
  for (const s of suppliers) {
    await query(
      `INSERT INTO suppliers (code, name, contact_person, phone, email, materials_supplied, payment_terms, performance_rating, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
      s
    );
  }
  console.log(`   Inserted ${suppliers.length} suppliers.\n`);

  // ============================================
  // STEP 7: CLIENTS (10 clients from clients.json + pricing JSON)
  // ============================================
  console.log('7. Inserting clients with real data...');
  const clients = [
    ['CLI-001', 'مزارع الدلتا للدواجن', 'Delta Poultry Farm', 'wholesale', 'active', 500000, '30 days', 170000, '01001234567', 'delta@example.com', 'الدقهلية'],
    ['CLI-002', 'مزرعة النور للدواجن', 'Al-Noor Poultry Farm', 'wholesale', 'active', 300000, '21 days', 85000, '01002345678', 'alnoor@example.com', 'الشرقية'],
    ['CLI-003', 'مزارع الجاموسي الأهلية', 'Al-Ahly Buffalo Farms', 'farm', 'active', 100000, 'cash', 15000, '01003456789', 'buffalo@example.com', 'البحيرة'],
    ['CLI-004', 'شركة الأمل للإنتاج الحيواني', 'Al-Amal Animal Production Co.', 'wholesale', 'active', 800000, '45 days', 245000, '01004567890', 'alamal@example.com', 'الغربية'],
    ['CLI-005', 'مزرعة السعيد للأغنام', 'Al-Saeed Sheep Farm', 'retail', 'active', 50000, 'cash', 0, '01005678901', 'alsaeed@example.com', 'سوهاج'],
    ['CLI-006', 'مزارع الشرقية للدواجن', 'Sharqia Poultry Farm', 'farm', 'active', 200000, '15 days', 45000, '01006789012', 'sharqia@example.com', 'الشرقية'],
    ['CLI-007', 'شركة الدلتا للأعلاف', 'Delta Feed Company', 'distributor', 'active', 1000000, '30 days', 320000, '01007890123', 'deltafeed@example.com', 'الدقهلية'],
    ['CLI-008', 'مزارع النيل للإنتاج الحيواني', 'Nile Animal Farms', 'farm', 'active', 150000, 'cash', 0, '01008901234', 'nile@example.com', 'القليوبية'],
    ['CLI-009', 'شركة الصعيد للدواجن', 'Upper Egypt Poultry Co.', 'wholesale', 'active', 600000, '30 days', 180000, '01009012345', 'saeed@example.com', 'أسيوط'],
    ['CLI-010', 'مزارع الفيوم للألبان والدواجن', 'Fayoum Dairy & Poultry', 'farm', 'active', 250000, '21 days', 75000, '01000123456', 'fayoum@example.com', 'الفيوم'],
  ];
  for (const c of clients) {
    await query(
      `INSERT INTO clients (code, name_arabic, name_english, type, status, credit_limit, payment_terms, current_balance, phone, email, address, city) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'placeholder address',$11)`,
      c
    );
  }
  console.log(`   Inserted ${clients.length} clients.\n`);

  // ============================================
  // STEP 8: CLIENT LIABILITIES
  // ============================================
  console.log('8. Inserting client liabilities...');
  const liabilities = [
    [1, 125000, '2025-01-15', '2025-02-15', 'رصيد سابق منفذ الدلتا', 'balance', 'pending'],
    [1, 45000, '2025-02-01', '2025-03-01', 'فاتورة علف بادى سوبر 25 كمية 100 شيكارة', 'invoice', 'pending'],
    [2, 85000, '2025-02-10', '2025-03-10', 'رصيد سابق', 'balance', 'pending'],
    [3, 15000, '2025-03-01', '2025-03-15', 'فاتورة علف جاموسي 16%', 'invoice', 'pending'],
    [4, 150000, '2025-01-20', '2025-03-05', 'رصيد سابق - تجاوز فترة السداد', 'balance', 'pending'],
    [4, 95000, '2025-02-15', '2025-04-01', 'فاتورة علف بياض انتاجي 50 كمية 200 شيكارة', 'invoice', 'pending'],
    [6, 45000, '2025-02-20', '2025-03-07', 'فاتورة علف', 'invoice', 'pending'],
    [7, 200000, '2025-01-10', '2025-02-10', 'رصيد سابق', 'balance', 'pending'],
    [7, 120000, '2025-02-25', '2025-03-27', 'فاتورة علف', 'invoice', 'pending'],
    [9, 120000, '2025-02-05', '2025-03-07', 'رصيد سابق', 'balance', 'pending'],
    [9, 60000, '2025-03-01', '2025-04-01', 'فاتورة علف', 'invoice', 'pending'],
    [10, 75000, '2025-02-28', '2025-03-21', 'فاتورة علف', 'invoice', 'pending'],
  ];
  for (const l of liabilities) {
    await query(
      `INSERT INTO client_liabilities (client_id, amount, date, due_date, description, type, status) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      l
    );
  }
  console.log(`   Inserted ${liabilities.length} liabilities.\n`);

  // ============================================
  // STEP 9: CLIENT EXPECTED PAYMENTS
  // ============================================
  console.log('9. Inserting expected payments...');
  const expectedPayments = [
    [1, 50000, '2025-03-30', 'قسط شهر مارس', 'expected'],
    [1, 30000, '2025-04-15', 'دفعة جزئية', 'expected'],
    [2, 25000, '2025-03-25', 'دفعة منتصف مارس', 'expected'],
    [2, 35000, '2025-04-10', 'تسوية الرصيد', 'expected'],
    [4, 80000, '2025-04-05', 'دفعة أولى', 'expected'],
    [4, 70000, '2025-04-20', 'دفعة ثانية', 'expected'],
    [6, 25000, '2025-04-01', 'دفعة شهر مارس', 'expected'],
    [7, 100000, '2025-04-15', 'دفعة تجارية', 'expected'],
    [9, 50000, '2025-04-10', 'دفعة', 'expected'],
    [10, 40000, '2025-04-05', 'دفعة', 'expected'],
  ];
  for (const ep of expectedPayments) {
    await query(
      `INSERT INTO client_expected_payments (client_id, amount, expected_date, description, status) VALUES ($1,$2,$3,$4,$5)`,
      ep
    );
  }
  console.log(`   Inserted ${expectedPayments.length} expected payments.\n`);

  // ============================================
  // STEP 10: CLIENT PAYMENT HISTORY
  // ============================================
  console.log('10. Inserting payment history...');
  const paymentHistory = [
    [1, 50000, '2025-02-15', 'دفعة شهر فبراير', 'cash'],
    [1, 75000, '2025-01-20', 'دفعة شهر يناير', 'bank_transfer'],
    [1, 60000, '2024-12-18', 'دفعة شهر ديسمبر', 'cash'],
    [1, 45000, '2024-11-22', 'دفعة شهر نوفمبر', 'bank_transfer'],
    [2, 40000, '2025-02-05', 'دفعة شهر فبراير', 'cash'],
    [2, 55000, '2025-01-12', 'دفعة شهر يناير', 'bank_transfer'],
    [2, 35000, '2024-12-20', 'دفعة شهر ديسمبر', 'cash'],
    [3, 20000, '2025-02-25', 'دفعة نقدية', 'cash'],
    [3, 15000, '2025-01-30', 'دفعة نقدية', 'cash'],
    [4, 100000, '2025-02-20', 'دفعة شهر فبراير', 'bank_transfer'],
    [4, 125000, '2025-01-25', 'دفعة شهر يناير', 'bank_transfer'],
    [4, 80000, '2024-12-28', 'دفعة شهر ديسمبر', 'bank_transfer'],
    [4, 95000, '2024-11-30', 'دفعة شهر نوفمبر', 'bank_transfer'],
    [6, 30000, '2025-02-28', 'دفعة شهر فبراير', 'cash'],
    [7, 150000, '2025-02-18', 'دفعة شهر فبراير', 'bank_transfer'],
    [7, 200000, '2025-01-15', 'دفعة شهر يناير', 'bank_transfer'],
    [9, 80000, '2025-02-22', 'دفعة شهر فبراير', 'bank_transfer'],
    [10, 50000, '2025-02-26', 'دفعة شهر فبراير', 'cash'],
  ];
  for (const ph of paymentHistory) {
    await query(
      `INSERT INTO client_payment_history (client_id, amount, date, description, method) VALUES ($1,$2,$3,$4,$5)`,
      ph
    );
  }
  console.log(`   Inserted ${paymentHistory.length} payment history records.\n`);

  // ============================================
  // STEP 11: FEED RECIPES (2 main recipes for testing)
  // ============================================
  console.log('11. Inserting feed recipes...');
  
  // Recipe 1: Super Starter 23% (FT001) - per 1000kg
  await query(
    `INSERT INTO feed_recipes (feed_type_id, version, name, total_quantity_kg, total_cost, is_active) VALUES (1, 1, 'وصفة علف سوبر بادى 23%', 1000, 19319600, true)`
  );
  const recipe1Items = [
    [1, 2, 600, 60.0, 15.00],    // ذره 600kg
    [1, 6, 300, 30.0, 19.35],    // صويا 46% 300kg
    [1, 4, 27.571, 2.7571, 10.80], // رده
    [1, 1, 5, 0.5, 38.50],       // جلوتين
    [1, 17, 33.853, 3.3853, 0.60], // حجر جيرى
    [1, 11, 2.5, 0.25, 112.00],   // بريمكس
    [1, 21, 3, 0.3, 1.85],       // ملح
    [1, 20, 1.5, 0.15, 100.00],   // لايسين
    [1, 23, 1.0, 0.10, 150.00],   // ميثونين
    [1, 22, 10, 1.0, 34.25],     // مونو كالسيوم
    [1, 15, 1.3, 0.13, 26.00],    // بيكربونات صوديوم
  ];
  for (const item of recipe1Items) {
    await query(
      `INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost) VALUES ($1, $2, $3, $4, $5)`,
      item
    );
  }

  // Recipe 2: Super Grower 21% (FT002) - per 1000kg
  await query(
    `INSERT INTO feed_recipes (feed_type_id, version, name, total_quantity_kg, total_cost, is_active) VALUES (2, 1, 'وصفة علف سوبر نامى 21%', 1000, 19129000, true)`
  );
  const recipe2Items = [
    [2, 2, 620, 62.0, 15.00],    // ذره 620kg
    [2, 6, 260, 26.0, 19.35],    // صويا 46% 260kg
    [2, 4, 50, 5.0, 10.80],      // رده
    [2, 1, 5, 0.5, 38.50],       // جلوتين
    [2, 17, 30, 3.0, 0.60],      // حجر جيرى
    [2, 11, 2.5, 0.25, 112.00],   // بريمكس
    [2, 21, 3, 0.3, 1.85],       // ملح
    [2, 20, 1.5, 0.15, 100.00],   // لايسين
    [2, 23, 0.8, 0.08, 150.00],   // ميثونين
    [2, 22, 9, 0.9, 34.25],      // مونو كالسيوم
    [2, 16, 1.0, 0.10, 95.00],    // ثريونين
  ];
  for (const item of recipe2Items) {
    await query(
      `INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost) VALUES ($1, $2, $3, $4, $5)`,
      item
    );
  }
  console.log('   Inserted 2 feed recipes with 22 recipe items.\n');

  // ============================================
  // STEP 12: TEST SALES DATA (to verify flow)
  // ============================================
  console.log('12. Creating test sales transactions...');

  // Sales order from Client 1 (Delta) - 50 bags Super Starter 23% (25kg)
  const orderResult = await query(
    `INSERT INTO sales_orders (order_number, client_id, status, total_amount, discount_amount, tax_amount, final_amount, payment_status, delivery_date, notes, created_by) 
     VALUES ('SO-00001', 1, 'approved', 25840000, 0, 0, 25840000, 'partial', '2026-05-15', 'طلب اختبار - 50 شيكارة علف سوبر بادى 25ك', 4)
     RETURNING id`
  );
  const orderId = orderResult.rows[0].id;
  
  await query(
    `INSERT INTO sales_order_items (order_id, feed_type_id, package_size, quantity, unit_price, total_price) 
     VALUES ($1, 1, 25, 50, 516800, 25840000)`,
    [orderId]
  );

  // Invoice for this order
  const invoiceResult = await query(
    `INSERT INTO invoices (invoice_number, order_id, client_id, amount, paid_amount, balance_due, status, issue_date, due_date, notes, created_by)
     VALUES ('INV-00001', $1, 1, 25840000, 3000000, 22840000, 'partial', '2026-05-11', '2026-06-10', 'فاتورة اختبار', 4)
     RETURNING id`,
    [orderId]
  );
  const invoiceId = invoiceResult.rows[0].id;

  await query(
    `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price)
     VALUES ($1, 'علف سوبر بادى 23% - 25كجم - 50 شيكارة', 50, 516800, 25840000)`,
    [invoiceId]
  );

  // Payment of 30000 EGP via client_payment_history
  await query(
    `INSERT INTO client_payment_history (client_id, invoice_id, amount, date, description, method, collected_by)
     VALUES (1, $1, 3000000, '2026-05-11', 'دفعة نقدية - فاتورة اختبار', 'cash', 4)`,
    [invoiceId]
  );

  // Reminder for Client 1
  await query(
    `INSERT INTO reminders (client_id, sales_rep_id, title, message, reminder_date, reminder_type, status)
     VALUES (1, 4, 'متابعة تحصيل', 'يرجى متابعة تحصيل مستحقات مزارع الدلتا', '2026-05-20', 'payment', 'pending')`
  );

  // Second sales order for Client 2
  const order2Result = await query(
    `INSERT INTO sales_orders (order_number, client_id, status, total_amount, discount_amount, tax_amount, final_amount, payment_status, delivery_date, notes, created_by)
     VALUES ('SO-00002', 2, 'pending_approval', 14557500, 0, 0, 14557500, 'pending', '2026-05-18', 'طلب اختبار - 25 شيكارة علف جاموسي 16% 50ك', 5)
     RETURNING id`
  );
  const order2Id = order2Result.rows[0].id;

  await query(
    `INSERT INTO sales_order_items (order_id, feed_type_id, package_size, quantity, unit_price, total_price)
     VALUES ($1, 17, 50, 25, 582300, 14557500)`,
    [order2Id]
  );

  console.log('   Created 2 sales orders, 1 invoice, 1 payment, 1 reminder.\n');

  // ============================================
  // STEP 13: ASSIGN SALES REPS TO CLIENTS
  // ============================================
  console.log('13. Assigning sales reps to clients...');
  // sales.rep1 (id=4) has clients 1,2,3,5
  await query("UPDATE clients SET assigned_to = 4, assigned_by = 3, assigned_at = NOW() WHERE id IN (1,2,3,5)");
  // sales.rep2 (id=5) has clients 4,6,7,10
  await query("UPDATE clients SET assigned_to = 5, assigned_by = 3, assigned_at = NOW() WHERE id IN (4,6,7,10)");
  console.log('   Done.\n');

  console.log('=== SEED COMPLETE ===');
  console.log('Summary:');
  const counts = await query(`
    SELECT 'users' as tbl, COUNT(*) FROM users
    UNION ALL SELECT 'feed_types', COUNT(*) FROM feed_types
    UNION ALL SELECT 'feed_pricing', COUNT(*) FROM feed_pricing
    UNION ALL SELECT 'raw_materials', COUNT(*) FROM raw_materials
    UNION ALL SELECT 'feed_recipes', COUNT(*) FROM feed_recipes
    UNION ALL SELECT 'feed_recipe_items', COUNT(*) FROM feed_recipe_items
    UNION ALL SELECT 'suppliers', COUNT(*) FROM suppliers
    UNION ALL SELECT 'clients', COUNT(*) FROM clients
    UNION ALL SELECT 'client_liabilities', COUNT(*) FROM client_liabilities
    UNION ALL SELECT 'client_expected_payments', COUNT(*) FROM client_expected_payments
    UNION ALL SELECT 'client_payment_history', COUNT(*) FROM client_payment_history
    UNION ALL SELECT 'sales_orders', COUNT(*) FROM sales_orders
    UNION ALL SELECT 'invoices', COUNT(*) FROM invoices
    UNION ALL SELECT 'client_payment_history', COUNT(*) FROM client_payment_history
    UNION ALL SELECT 'reminders', COUNT(*) FROM reminders
    ORDER BY tbl
  `);
  for (const row of counts.rows) {
    console.log(`   ${row.tbl}: ${row.count}`);
  }

  await pool.end();
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
