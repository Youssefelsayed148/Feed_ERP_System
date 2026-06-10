-- Al Kheir Feed Factory - Client and Supplier Data Migration
-- Created from al kheir pricing/clients.json

-- ============================================
-- 6. INSERT CLIENTS (4 existing + 6 additional)
-- ============================================

-- Original 4 clients from JSON data
INSERT INTO clients (code, name_arabic, name_english, type, status, credit_limit, payment_terms, current_balance, phone, email, address, city) VALUES
('CLI-001', 'مزارع الدلتا للدواجن', 'Delta Poultry Farm', 'wholesale', 'active', 500000, '30 days', 170000, '01001234567', 'delta@example.com', 'طريق المنصورة - دمياط، الدقهلية', 'الدقهلية'),
('CLI-002', 'مزرعة النور للدواجن', 'Al-Noor Poultry Farm', 'wholesale', 'active', 300000, '21 days', 85000, '01002345678', 'alnoor@example.com', 'الزقازيق، الشرقية', 'الشرقية'),
('CLI-003', 'مزارع الجاموسي الأهلية', 'Al-Ahly Buffalo Farms', 'farm', 'active', 100000, 'cash', 15000, '01003456789', 'buffalo@example.com', 'دمنهور، البحيرة', 'البحيرة'),
('CLI-004', 'شركة الأمل للإنتاج الحيواني', 'Al-Amal Animal Production Co.', 'wholesale', 'active', 800000, '45 days', 245000, '01004567890', 'alamal@example.com', 'طنطا، الغربية', 'الغربية');

-- Additional 6 clients
INSERT INTO clients (code, name_arabic, name_english, type, status, credit_limit, payment_terms, current_balance, phone, email, address, city) VALUES
('CLI-005', 'مزارع الشرقية للدواجن', 'Sharqia Poultry Farm', 'farm', 'active', 200000, '15 days', 45000, '01005678901', 'sharqia@example.com', 'فاقوس، الشرقية', 'الشرقية'),
('CLI-006', 'شركة الدلتا للأعلاف', 'Delta Feed Company', 'distributor', 'active', 1000000, '30 days', 320000, '01006789012', 'deltafeed@example.com', 'المنصورة، الدقهلية', 'الدقهلية'),
('CLI-007', 'مزارع النيل للإنتاج الحيواني', 'Nile Animal Farms', 'farm', 'active', 150000, 'cash', 0, '01007890123', 'nile@example.com', 'بنها، القليوبية', 'القليوبية'),
('CLI-008', 'شركة الصعيد للدواجن', 'Upper Egypt Poultry Co.', 'wholesale', 'active', 600000, '30 days', 180000, '01008901234', 'saeed@example.com', 'أسيوط، أسيوط', 'أسيوط'),
('CLI-009', 'مزارع الفيوم للألبان والدواجن', 'Fayoum Dairy & Poultry', 'farm', 'active', 250000, '21 days', 75000, '01009012345', 'fayoum@example.com', 'الفيوم، الفيوم', 'الفيوم'),
('CLI-010', 'شركة الإسكندرية للإنتاج الحيواني', 'Alexandria Animal Production', 'distributor', 'active', 750000, '45 days', 290000, '01000123456', 'alex@example.com', 'الإسكندرية', 'الإسكندرية');

-- ============================================
-- 7. INSERT CLIENT LIABILITIES
-- ============================================

-- Client 1 (Delta) liabilities
INSERT INTO client_liabilities (client_id, amount, date, due_date, description, type, status) VALUES
(1, 125000, '2025-01-15', '2025-02-15', 'رصيد سابق منفذ الدلتا', 'balance', 'pending'),
(1, 45000, '2025-02-01', '2025-03-01', 'فاتورة علف بادى سوبر 25 كمية 100 شيكارة', 'invoice', 'pending');

-- Client 2 (Al-Noor) liabilities
INSERT INTO client_liabilities (client_id, amount, date, due_date, description, type, status) VALUES
(2, 85000, '2025-02-10', '2025-03-10', 'رصيد سابق', 'balance', 'pending');

-- Client 3 (Buffalo) liabilities
INSERT INTO client_liabilities (client_id, amount, date, due_date, description, type, status) VALUES
(3, 15000, '2025-03-01', '2025-03-15', 'فاتورة علف جاموسي 16%', 'invoice', 'pending');

-- Client 4 (Al-Amal) liabilities
INSERT INTO client_liabilities (client_id, amount, date, due_date, description, type, status) VALUES
(4, 150000, '2025-01-20', '2025-03-05', 'رصيد سابق - تجاوز فترة السداد', 'balance', 'pending'),
(4, 95000, '2025-02-15', '2025-04-01', 'فاتورة علف بياض انتاجي 50 كمية 200 شيكارة', 'invoice', 'pending');

-- Additional clients liabilities
INSERT INTO client_liabilities (client_id, amount, date, due_date, description, type, status) VALUES
(5, 45000, '2025-02-20', '2025-03-07', 'فاتورة علف سوبر نامي 50 كمية 80 شيكارة', 'invoice', 'pending'),
(6, 200000, '2025-01-10', '2025-02-10', 'رصيد سابق - قيد التسوية', 'balance', 'pending'),
(6, 120000, '2025-02-25', '2025-03-27', 'فاتورة علف متنوع كمية 500 شيكارة', 'invoice', 'pending'),
(8, 120000, '2025-02-05', '2025-03-07', 'رصيد سابق', 'balance', 'pending'),
(8, 60000, '2025-03-01', '2025-04-01', 'فاتورة علف بياض كمية 150 شيكارة', 'invoice', 'pending'),
(9, 75000, '2025-02-28', '2025-03-21', 'فاتورة علف سوبر بادي 25 كمية 120 شيكارة', 'invoice', 'pending'),
(10, 180000, '2025-01-25', '2025-03-11', 'رصيد سابق - تجاوز', 'balance', 'pending'),
(10, 110000, '2025-03-05', '2025-04-20', 'فاتورة علف بط 50 كمية 180 شيكارة', 'invoice', 'pending');

-- ============================================
-- 8. INSERT EXPECTED PAYMENTS
-- ============================================

-- Client 1 expected payments
INSERT INTO client_expected_payments (client_id, amount, expected_date, description, status) VALUES
(1, 50000, '2025-03-30', 'قسط شهر مارس', 'expected'),
(1, 30000, '2025-04-15', 'دفعة جزئية', 'expected');

-- Client 2 expected payments
INSERT INTO client_expected_payments (client_id, amount, expected_date, description, status) VALUES
(2, 25000, '2025-03-25', 'دفعة منتصف مارس', 'expected'),
(2, 35000, '2025-04-10', 'تسوية الرصيد', 'expected');

-- Client 4 expected payments
INSERT INTO client_expected_payments (client_id, amount, expected_date, description, status) VALUES
(4, 80000, '2025-04-05', 'دفعة أولى لتسوية المتأخرات', 'expected'),
(4, 70000, '2025-04-20', 'دفعة ثانية', 'expected');

-- Additional clients expected payments
INSERT INTO client_expected_payments (client_id, amount, expected_date, description, status) VALUES
(5, 25000, '2025-04-01', 'دفعة شهر مارس', 'expected'),
(6, 100000, '2025-04-15', 'دفعة تجارية', 'expected'),
(8, 50000, '2025-04-10', 'دفعة منتصف مارس', 'expected'),
(9, 40000, '2025-04-05', 'دفعة شهر مارس', 'expected'),
(10, 90000, '2025-04-25', 'دفعة أولى لتسوية', 'expected');

-- ============================================
-- 9. INSERT PAYMENT HISTORY
-- ============================================

-- Client 1 payment history
INSERT INTO client_payment_history (client_id, amount, date, description, method) VALUES
(1, 50000, '2025-02-15', 'دفعة شهر فبراير', 'cash'),
(1, 75000, '2025-01-20', 'دفعة شهر يناير', 'bank_transfer'),
(1, 60000, '2024-12-18', 'دفعة شهر ديسمبر', 'cash'),
(1, 45000, '2024-11-22', 'دفعة شهر نوفمبر', 'bank_transfer');

-- Client 2 payment history
INSERT INTO client_payment_history (client_id, amount, date, description, method) VALUES
(2, 40000, '2025-02-05', 'دفعة شهر فبراير', 'cash'),
(2, 55000, '2025-01-12', 'دفعة شهر يناير', 'bank_transfer'),
(2, 35000, '2024-12-20', 'دفعة شهر ديسمبر', 'cash');

-- Client 3 payment history
INSERT INTO client_payment_history (client_id, amount, date, description, method) VALUES
(3, 20000, '2025-02-25', 'دفعة نقدية', 'cash'),
(3, 15000, '2025-01-30', 'دفعة نقدية', 'cash');

-- Client 4 payment history
INSERT INTO client_payment_history (client_id, amount, date, description, method) VALUES
(4, 100000, '2025-02-20', 'دفعة شهر فبراير', 'bank_transfer'),
(4, 125000, '2025-01-25', 'دفعة شهر يناير', 'bank_transfer'),
(4, 80000, '2024-12-28', 'دفعة شهر ديسمبر', 'bank_transfer'),
(4, 95000, '2024-11-30', 'دفعة شهر نوفمبر', 'bank_transfer');

-- Additional clients payment history
INSERT INTO client_payment_history (client_id, amount, date, description, method) VALUES
(5, 30000, '2025-02-28', 'دفعة شهر فبراير', 'cash'),
(6, 150000, '2025-02-18', 'دفعة شهر فبراير', 'bank_transfer'),
(6, 200000, '2025-01-15', 'دفعة شهر يناير', 'bank_transfer'),
(8, 80000, '2025-02-22', 'دفعة شهر فبراير', 'bank_transfer'),
(9, 50000, '2025-02-26', 'دفعة شهر فبراير', 'cash'),
(10, 120000, '2025-03-01', 'دفعة شهر فبراير', 'bank_transfer');

-- ============================================
-- 10. INSERT SUPPLIERS
-- ============================================

INSERT INTO suppliers (code, name, contact_person, phone, email, address, materials_supplied, payment_terms, performance_rating, is_active) VALUES
('SUP-001', 'شركة الدلتا للحبوب', 'أحمد محمد', '01001234501', 'delta.grains@example.com', 'المنصورة، الدقهلية', ARRAY['RM001', 'RM003'], '15 days', 4, true),
('SUP-002', 'الشركة المصرية للصويا', 'محمد علي', '01001234502', 'soya.egypt@example.com', 'الإسكندرية', ARRAY['RM002'], '30 days', 5, true),
('SUP-003', 'مصنع الجلوتين العربي', 'خالد حسن', '01001234503', 'gluten.arab@example.com', '6 أكتوبر، الجيزة', ARRAY['RM004'], 'cash', 4, true),
('SUP-004', 'شركة الزيوت المصرية', 'سمير فؤاد', '01001234504', 'oil.egypt@example.com', 'الإسكندرية', ARRAY['RM005'], '21 days', 3, true),
('SUP-005', 'مضافات الأعلاف الحديثة', 'طارق محمود', '01001234505', 'additives.modern@example.com', 'القاهرة', ARRAY['RM007', 'RM008', 'RM009', 'RM010', 'RM011'], '30 days', 5, true),
('SUP-006', 'الشركة الوطنية للأنزيمات', 'محمود عبدالله', '01001234506', 'enzymes.nat@example.com', 'العاشر من رمضان', ARRAY['RM020', 'RM022', 'RM023'], '45 days', 4, true),
('SUP-007', 'المستحضرات البيطرية', 'ياسر إبراهيم', '01001234507', 'vet.prep@example.com', 'القاهرة', ARRAY['RM018', 'RM019'], '30 days', 4, true),
('SUP-008', 'مصنع الشكاير المصري', 'عادل سعيد', '01001234508', 'bags.egypt@example.com', 'العاشر من رمضان', ARRAY['RM025'], 'cash', 5, true);

SELECT 'Clients, liabilities, payments, and suppliers inserted successfully' as status;
SELECT 'Total clients: ' || COUNT(*) FROM clients;
SELECT 'Total liabilities: ' || COUNT(*) FROM client_liabilities;
SELECT 'Total expected payments: ' || COUNT(*) FROM client_expected_payments;
SELECT 'Total payment history: ' || COUNT(*) FROM client_payment_history;
SELECT 'Total suppliers: ' || COUNT(*) FROM suppliers;
