-- =====================================================
-- SEED DATA - Al Kheir Feed Factory
-- Run AFTER schema.sql. Populates all reference data.
-- All INSERTs use ON CONFLICT DO NOTHING for idempotency.
-- =====================================================

-- ---------- 1. DEFAULT COMPANY ----------
INSERT INTO companies (name_arabic, name_english)
VALUES ('مصنع الخير للأعلاف', 'Al Kheir Feed Factory')
ON CONFLICT DO NOTHING;

-- ---------- 2. ACCOUNTS (Chart of Accounts) ----------
-- payroll.js hardcodes account_id=1 (Cash) and account_id=8 (Salaries Expense).
-- IDs must match exactly because payroll.js uses literal integers.
INSERT INTO accounts (id, name, type, is_active) VALUES
(1,  'النقدية',                    'asset',     true),
(2,  'حسابات القبض',               'asset',     true),
(3,  'مخزون - مواد خام',           'asset',     true),
(4,  'مخزون - منتجات تامة',        'asset',     true),
(5,  'حسابات الدفع',               'liability', true),
(6,  'حقوق الملكية',               'equity',    true),
(7,  'إيرادات المبيعات',           'revenue',   true),
(8,  'مصروفات الرواتب والأجور',    'expense',   true),
(9,  'تكلفة البضاعة المباعة',      'expense',   true),
(10, 'مصروفات أخرى',              'expense',   true)
ON CONFLICT (id) DO NOTHING;

-- Reset sequence so future INSERTs start after the max ID
SELECT setval('accounts_id_seq', (SELECT MAX(id) FROM accounts), true);

-- ---------- 3. USERS (11 users) ----------
-- Password for all: "password123"
-- bcrypt hash: $2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O
INSERT INTO users (email, password_hash, name, role, phone, department, is_active) VALUES
('owner@al-kheir.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Owner', 'owner', '+966501234567', 'Management', true),
('admin@al-kheir.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'System Administrator', 'admin', '+966501234568', 'IT', true),
('sales.manager@al-kheir.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Sales Manager', 'sales_manager', '+966501234569', 'Sales', true),
('sales.rep1@al-kheir.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Sales Representative 1', 'sales_rep', '+966501234570', 'Sales', true),
('sales.rep2@al-kheir.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Sales Representative 2', 'sales_rep', '+966501234571', 'Sales', true),
('production.manager@al-kheir.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Production Manager', 'production_manager', '+966501234572', 'Production', true),
('finance.manager@al-kheir.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Finance Manager', 'finance_manager', '+966501234573', 'Finance', true),
('purchase.officer@al-kheir.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Purchase Officer', 'purchase_officer', '+966501234574', 'Procurement', true),
('hr.manager@al-kheir.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'HR Manager', 'hr_manager', '+966501234575', 'HR', true),
('warehouse.manager@al-kheir.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Warehouse Manager', 'warehouse_manager', '+966501234576', 'Warehouse', true),
('quality.assistant@al-kheir.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Quality Assistant', 'quality_assistant', '+966501234577', 'Quality', true)
ON CONFLICT (email) DO NOTHING;

-- ---------- 4. APPROVAL SETTINGS ----------
INSERT INTO approval_settings (module_name, requires_approval) VALUES
('sales_orders', true),
('purchase_orders', true),
('payroll', true),
('expenses', true),
('production', true),
('inventory_adjustments', true)
ON CONFLICT (module_name) DO NOTHING;

-- ---------- 5. FEED TYPES (16 types) ----------
INSERT INTO feed_types (code, name_arabic, name_english, protein_percentage, category, sub_category) VALUES
('FT001', 'علف سوبر بادى 23%', 'Super Starter Feed 23%', '23%', 'poultry', 'starter'),
('FT002', 'علف سوبر نامى 21%', 'Super Grower Feed 21%', '21%', 'poultry', 'grower'),
('FT003', 'علف سوبر ناهى 19%', 'Super Finisher Feed 19%', '19%', 'poultry', 'finisher'),
('FT004', 'علف بادى نامى 21%', 'Broiler Starter-Grower Feed 21%', '21%', 'poultry', 'broiler_starter_grower'),
('FT005', 'علف بادى بياض 20%', 'Layer Starter Feed 20%', '20%', 'poultry', 'layer_starter'),
('FT006', 'علف نامى 1 بياض 18%', 'Layer Grower Feed 1 (18%)', '18%', 'poultry', 'layer_grower1'),
('FT007', 'علف نامى 2 بياض 16%', 'Layer Grower Feed 2 (16%)', '16%', 'poultry', 'layer_grower2'),
('FT008', 'علف بياض تحضيرى 17.5%', 'Layer Pre-Lay Feed 17.5%', '17.5%', 'poultry', 'layer_prelay'),
('FT009', 'علف بياض انتاجى 18%', 'Layer Production Feed 18%', '18%', 'poultry', 'layer_production_18'),
('FT010', 'علف بياض انتاجى 17%', 'Layer Production Feed 17%', '17%', 'poultry', 'layer_production_17'),
('FT011', 'علف بياض انتاجى 16%', 'Layer Production Feed 16%', '16%', 'poultry', 'layer_production_16'),
('FT012', 'علف بياض انتاجى 14%', 'Layer Production Feed 14%', '14%', 'poultry', 'layer_production_14'),
('FT013', 'علف بادى بط 22%', 'Duck Starter Feed 22%', '22%', 'poultry', 'duck_starter'),
('FT014', 'علف نامى بط 18%', 'Duck Grower Feed 18%', '18%', 'poultry', 'duck_grower'),
('FT015', 'علف بادى نامى منزلى 21%', 'Home Broiler Feed 21%', '21%', 'poultry', 'home_broiler'),
('FT016', 'علف سوبر بادى 24%', 'Super Starter Feed 24%', '24%', 'poultry', 'starter_24')
ON CONFLICT (code) DO NOTHING;

-- ---------- 6. FEED PRICING (48 records) ----------
INSERT INTO feed_pricing (feed_type_id, package_size, cost_price, selling_price_7, selling_price_75, selling_price_8, max_price) VALUES
(1, 10, 193196, 206720, 207690, 212210, 214210),
(1, 25, 482991, 516800, 519225, 530525, 535525),
(1, 50, 965981, 1033600, 1038450, 1061050, 1071050),
(2, 10, 191290, 204680, 205640, 210440, 212440),
(2, 25, 478224, 511700, 514100, 526100, 531100),
(2, 50, 956449, 1023400, 1028200, 1052200, 1062200),
(3, 10, 187551, 200680, 201620, 206690, 208690),
(3, 25, 468879, 501700, 504050, 516725, 521725),
(3, 50, 937757, 1003400, 1008100, 1033450, 1043450),
(4, 10, 181421, 194120, 195030, 199250, 201250),
(4, 25, 453552, 485300, 487575, 498125, 503125),
(4, 50, 907103, 970600, 975150, 996250, 1006250),
(5, 10, 182187, 194940, 195850, 200240, 202240),
(5, 25, 455467, 487350, 489625, 500600, 505600),
(5, 50, 910935, 974700, 979250, 1001200, 1011200),
(6, 10, 175234, 187500, 188370, 192770, 194770),
(6, 25, 438084, 468750, 470925, 481925, 486925),
(6, 50, 876168, 937500, 941850, 963850, 973850),
(7, 10, 165514, 177100, 177930, 182400, 184400),
(7, 25, 413785, 442750, 444825, 456000, 461000),
(7, 50, 827570, 885500, 889650, 912000, 922000),
(8, 10, 160280, 171500, 180920, 185340, 187340),
(8, 25, 400700, 428750, 452300, 463350, 468350),
(8, 50, 801401, 857500, 904600, 926700, 936700),
(9, 10, 155607, 166500, 178210, 182390, 184390),
(9, 25, 389019, 416250, 445525, 455975, 460975),
(9, 50, 778037, 832500, 891050, 911950, 921950),
(10, 10, 153738, 164500, 176080, 180380, 182380),
(10, 25, 384346, 411250, 440200, 450950, 455950),
(10, 50, 768692, 822500, 880400, 901900, 911900),
(11, 10, 151869, 162500, 171630, 175940, 177940),
(11, 25, 379673, 406250, 429075, 439850, 444850),
(11, 50, 759346, 812500, 858150, 879700, 889700),
(12, 10, 148648, 159000, 162900, 166880, 168880),
(12, 25, 371620, 397500, 407250, 417200, 422200),
(12, 50, 743240, 795000, 814500, 834400, 844400),
(13, 10, 189800, 203100, 204000, 208950, 210950),
(13, 25, 474500, 507750, 510000, 522375, 527375),
(13, 50, 949000, 1015500, 1020000, 1044750, 1054750),
(14, 10, 175000, 187250, 188100, 192600, 194600),
(14, 25, 437500, 468125, 470250, 481500, 486500),
(14, 50, 875000, 936250, 940500, 963000, 973000),
(15, 10, 183200, 196024, 196950, 201456, 203456),
(15, 25, 458000, 490060, 492375, 503640, 508640),
(15, 50, 916000, 980120, 984750, 1007280, 1017280),
(16, 10, 201500, 215605, 216600, 221720, 223720),
(16, 25, 503750, 539012, 541500, 554300, 559300),
(16, 50, 1007500, 1078025, 1083000, 1108600, 1118600)
ON CONFLICT (feed_type_id, package_size) DO NOTHING;

-- ---------- 7. RAW MATERIALS (25 ingredients) ----------
INSERT INTO raw_materials (code, name_arabic, name_english, category, unit_price, current_stock, min_stock_level, reorder_level) VALUES
('RM001', 'ذرة', 'Corn', 'grain', 15.00, 50000, 5000, 10000),
('RM002', 'صويا 46%', 'Soybean 46%', 'protein', 19.35, 30000, 3000, 6000),
('RM003', 'ردة', 'Wheat Bran', 'grain', 10.80, 25000, 2500, 5000),
('RM004', 'جلوتين', 'Gluten', 'protein', 38.50, 5000, 500, 1000),
('RM005', 'زيت صويا', 'Soybean Oil', 'oil', 50.00, 2000, 200, 400),
('RM006', 'سن', 'Chaff/Straw', 'fiber', 12.00, 10000, 1000, 2000),
('RM007', 'ميثونين', 'Methionine', 'additive', 150.00, 500, 50, 100),
('RM008', 'ليسين', 'Lysine', 'additive', 100.00, 500, 50, 100),
('RM009', 'مونو كالسيوم', 'Mono Calcium', 'mineral', 45.00, 2000, 200, 400),
('RM010', 'حجر جيرى', 'Limestone', 'mineral', 0.60, 30000, 3000, 6000),
('RM011', 'بريمكس', 'Premix', 'additive', 94.00, 1000, 100, 200),
('RM012', 'ملح طعام', 'Salt', 'mineral', 1.80, 5000, 500, 1000),
('RM013', 'بيكربونات صوديوم', 'Sodium Bicarbonate', 'additive', 26.00, 1000, 100, 200),
('RM014', 'اندسورب', 'Adsorbent', 'additive', 20.00, 800, 80, 160),
('RM015', 'مضاد سموم بولجى', 'Mycotoxin Binder', 'additive', 200.00, 500, 50, 100),
('RM016', 'ثيريونين', 'Threonine', 'additive', 95.00, 300, 30, 60),
('RM017', 'مستحلب دهون', 'Fat Emulsion', 'additive', 290.00, 200, 20, 40),
('RM018', 'مديورا مايسين', 'Mediora Mycin', 'medication', 80.00, 150, 15, 30),
('RM019', 'تراى اند بوت 3', 'Tri-Boot 3', 'medication', 265.00, 100, 10, 20),
('RM020', 'انزيم فايتيز', 'Phytase Enzyme', 'enzyme', 400.00, 100, 10, 20),
('RM021', 'بيتاين', 'Betaine', 'additive', 75.00, 200, 20, 40),
('RM022', 'سيبنزا (انزيم بروتيز)', 'Sepenza (Protease)', 'enzyme', 450.00, 50, 5, 10),
('RM023', 'انزيم طاقه', 'Energy Enzyme', 'enzyme', 200.00, 100, 10, 20),
('RM024', 'بيودى', 'Biody', 'additive', 450.00, 50, 5, 10),
('RM025', 'شكاير', 'Bags/Sacks', 'packaging', 13.00, 10000, 1000, 2000)
ON CONFLICT (code) DO NOTHING;

-- ---------- 8. CLIENTS (10 clients) ----------
INSERT INTO clients (code, name_arabic, name_english, type, status, credit_limit, payment_terms, current_balance, phone, email, address, city) VALUES
('CLI-001', 'مزارع الدلتا للدواجن', 'Delta Poultry Farm', 'wholesale', 'active', 500000, '30 days', 170000, '01001234567', 'delta@example.com', 'طريق المنصورة - دمياط، الدقهلية', 'الدقهلية'),
('CLI-002', 'مزرعة النور للدواجن', 'Al-Noor Poultry Farm', 'wholesale', 'active', 300000, '21 days', 85000, '01002345678', 'alnoor@example.com', 'الزقازيق، الشرقية', 'الشرقية'),
('CLI-003', 'مزارع الجاموسي الأهلية', 'Al-Ahly Buffalo Farms', 'farm', 'active', 100000, 'cash', 15000, '01003456789', 'buffalo@example.com', 'دمنهور، البحيرة', 'البحيرة'),
('CLI-004', 'شركة الأمل للإنتاج الحيواني', 'Al-Amal Animal Production Co.', 'wholesale', 'active', 800000, '45 days', 245000, '01004567890', 'alamal@example.com', 'طنطا، الغربية', 'الغربية'),
('CLI-005', 'مزارع الشرقية للدواجن', 'Sharqia Poultry Farm', 'farm', 'active', 200000, '15 days', 45000, '01005678901', 'sharqia@example.com', 'فاقوس، الشرقية', 'الشرقية'),
('CLI-006', 'شركة الدلتا للأعلاف', 'Delta Feed Company', 'distributor', 'active', 1000000, '30 days', 320000, '01006789012', 'deltafeed@example.com', 'المنصورة، الدقهلية', 'الدقهلية'),
('CLI-007', 'مزارع النيل للإنتاج الحيواني', 'Nile Animal Farms', 'farm', 'active', 150000, 'cash', 0, '01007890123', 'nile@example.com', 'بنها، القليوبية', 'القليوبية'),
('CLI-008', 'شركة الصعيد للدواجن', 'Upper Egypt Poultry Co.', 'wholesale', 'active', 600000, '30 days', 180000, '01008901234', 'saeed@example.com', 'أسيوط، أسيوط', 'أسيوط'),
('CLI-009', 'مزارع الفيوم للألبان والدواجن', 'Fayoum Dairy & Poultry', 'farm', 'active', 250000, '21 days', 75000, '01009012345', 'fayoum@example.com', 'الفيوم، الفيوم', 'الفيوم'),
('CLI-010', 'شركة الإسكندرية للإنتاج الحيواني', 'Alexandria Animal Production', 'distributor', 'active', 750000, '45 days', 290000, '01000123456', 'alex@example.com', 'الإسكندرية', 'الإسكندرية')
ON CONFLICT (code) DO NOTHING;

-- ---------- 9. SUPPLIERS (8 suppliers) ----------
INSERT INTO suppliers (code, name, contact_person, phone, email, address, materials_supplied, payment_terms, performance_rating, is_active) VALUES
('SUP-001', 'شركة الدلتا للحبوب', 'أحمد محمد', '01001234501', 'delta.grains@example.com', 'المنصورة، الدقهلية', ARRAY['RM001', 'RM003'], '15 days', 4, true),
('SUP-002', 'الشركة المصرية للصويا', 'محمد علي', '01001234502', 'soya.egypt@example.com', 'الإسكندرية', ARRAY['RM002'], '30 days', 5, true),
('SUP-003', 'مصنع الجلوتين العربي', 'خالد حسن', '01001234503', 'gluten.arab@example.com', '6 أكتوبر، الجيزة', ARRAY['RM004'], 'cash', 4, true),
('SUP-004', 'شركة الزيوت المصرية', 'سمير فؤاد', '01001234504', 'oil.egypt@example.com', 'الإسكندرية', ARRAY['RM005'], '21 days', 3, true),
('SUP-005', 'مضافات الأعلاف الحديثة', 'طارق محمود', '01001234505', 'additives.modern@example.com', 'القاهرة', ARRAY['RM007', 'RM008', 'RM009', 'RM010', 'RM011'], '30 days', 5, true),
('SUP-006', 'الشركة الوطنية للأنزيمات', 'محمود عبدالله', '01001234506', 'enzymes.nat@example.com', 'العاشر من رمضان', ARRAY['RM020', 'RM022', 'RM023'], '45 days', 4, true),
('SUP-007', 'المستحضرات البيطرية', 'ياسر إبراهيم', '01001234507', 'vet.prep@example.com', 'القاهرة', ARRAY['RM018', 'RM019'], '30 days', 4, true),
('SUP-008', 'مصنع الشكاير المصري', 'عادل سعيد', '01001234508', 'bags.egypt@example.com', 'العاشر من رمضان', ARRAY['RM025'], 'cash', 5, true)
ON CONFLICT (code) DO NOTHING;

-- ---------- 10. CLIENT LIABILITIES ----------
INSERT INTO client_liabilities (client_id, amount, date, due_date, description, type, status) VALUES
(1, 125000, '2025-01-15', '2025-02-15', 'رصيد سابق منفذ الدلتا', 'balance', 'pending'),
(1, 45000, '2025-02-01', '2025-03-01', 'فاتورة علف بادى سوبر 25 كمية 100 شيكارة', 'invoice', 'pending'),
(2, 85000, '2025-02-10', '2025-03-10', 'رصيد سابق', 'balance', 'pending'),
(3, 15000, '2025-03-01', '2025-03-15', 'فاتورة علف جاموسي 16%', 'invoice', 'pending'),
(4, 150000, '2025-01-20', '2025-03-05', 'رصيد سابق - تجاوز فترة السداد', 'balance', 'pending'),
(4, 95000, '2025-02-15', '2025-04-01', 'فاتورة علف بياض انتاجي 50 كمية 200 شيكارة', 'invoice', 'pending'),
(5, 45000, '2025-02-20', '2025-03-07', 'فاتورة علف سوبر نامي 50 كمية 80 شيكارة', 'invoice', 'pending'),
(6, 200000, '2025-01-10', '2025-02-10', 'رصيد سابق - قيد التسوية', 'balance', 'pending'),
(6, 120000, '2025-02-25', '2025-03-27', 'فاتورة علف متنوع كمية 500 شيكارة', 'invoice', 'pending'),
(8, 120000, '2025-02-05', '2025-03-07', 'رصيد سابق', 'balance', 'pending'),
(8, 60000, '2025-03-01', '2025-04-01', 'فاتورة علف بياض كمية 150 شيكارة', 'invoice', 'pending'),
(9, 75000, '2025-02-28', '2025-03-21', 'فاتورة علف سوبر بادي 25 كمية 120 شيكارة', 'invoice', 'pending'),
(10, 180000, '2025-01-25', '2025-03-11', 'رصيد سابق - تجاوز', 'balance', 'pending'),
(10, 110000, '2025-03-05', '2025-04-20', 'فاتورة علف بط 50 كمية 180 شيكارة', 'invoice', 'pending');

-- ---------- 11. CLIENT EXPECTED PAYMENTS ----------
INSERT INTO client_expected_payments (client_id, amount, expected_date, description, status) VALUES
(1, 50000, '2025-03-30', 'قسط شهر مارس', 'expected'),
(1, 30000, '2025-04-15', 'دفعة جزئية', 'expected'),
(2, 25000, '2025-03-25', 'دفعة منتصف مارس', 'expected'),
(2, 35000, '2025-04-10', 'تسوية الرصيد', 'expected'),
(4, 80000, '2025-04-05', 'دفعة أولى لتسوية المتأخرات', 'expected'),
(4, 70000, '2025-04-20', 'دفعة ثانية', 'expected'),
(5, 25000, '2025-04-01', 'دفعة شهر مارس', 'expected'),
(6, 100000, '2025-04-15', 'دفعة تجارية', 'expected'),
(8, 50000, '2025-04-10', 'دفعة منتصف مارس', 'expected'),
(9, 40000, '2025-04-05', 'دفعة شهر مارس', 'expected'),
(10, 90000, '2025-04-25', 'دفعة أولى لتسوية', 'expected');

-- ---------- 12. CLIENT PAYMENT HISTORY ----------
INSERT INTO client_payment_history (client_id, amount, date, description, method) VALUES
(1, 50000, '2025-02-15', 'دفعة شهر فبراير', 'cash'),
(1, 75000, '2025-01-20', 'دفعة شهر يناير', 'bank_transfer'),
(1, 60000, '2024-12-18', 'دفعة شهر ديسمبر', 'cash'),
(1, 45000, '2024-11-22', 'دفعة شهر نوفمبر', 'bank_transfer'),
(2, 40000, '2025-02-05', 'دفعة شهر فبراير', 'cash'),
(2, 55000, '2025-01-12', 'دفعة شهر يناير', 'bank_transfer'),
(2, 35000, '2024-12-20', 'دفعة شهر ديسمبر', 'cash'),
(3, 20000, '2025-02-25', 'دفعة نقدية', 'cash'),
(3, 15000, '2025-01-30', 'دفعة نقدية', 'cash'),
(4, 100000, '2025-02-20', 'دفعة شهر فبراير', 'bank_transfer'),
(4, 125000, '2025-01-25', 'دفعة شهر يناير', 'bank_transfer'),
(4, 80000, '2024-12-28', 'دفعة شهر ديسمبر', 'bank_transfer'),
(4, 95000, '2024-11-30', 'دفعة شهر نوفمبر', 'bank_transfer'),
(5, 30000, '2025-02-28', 'دفعة شهر فبراير', 'cash'),
(6, 150000, '2025-02-18', 'دفعة شهر فبراير', 'bank_transfer'),
(6, 200000, '2025-01-15', 'دفعة شهر يناير', 'bank_transfer'),
(8, 80000, '2025-02-22', 'دفعة شهر فبراير', 'bank_transfer'),
(9, 50000, '2025-02-26', 'دفعة شهر فبراير', 'cash'),
(10, 120000, '2025-03-01', 'دفعة شهر فبراير', 'bank_transfer');

-- ---------- 13. VERIFICATION ----------
SELECT 'SEED DATA PART 1 COMPLETE' as status,
    (SELECT COUNT(*) FROM users) as users_count,
    (SELECT COUNT(*) FROM clients) as clients_count,
    (SELECT COUNT(*) FROM suppliers) as suppliers_count,
    (SELECT COUNT(*) FROM feed_types) as feed_types_count,
    (SELECT COUNT(*) FROM feed_pricing) as pricing_count,
    (SELECT COUNT(*) FROM raw_materials) as materials_count,
    (SELECT COUNT(*) FROM accounts) as accounts_count,
    (SELECT COUNT(*) FROM client_liabilities) as liabilities_count,
    (SELECT COUNT(*) FROM client_expected_payments) as expected_count,
    (SELECT COUNT(*) FROM client_payment_history) as payments_count;