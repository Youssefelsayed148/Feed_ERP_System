-- Al Kheir Feed Factory - Data Migration Script
-- This script populates the database with all feed types, pricing, recipes, and client data
-- Run this after creating the schema

-- ============================================
-- 1. INSERT FEED TYPES (16 types)
-- ============================================

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
('FT016', 'علف سوبر بادى 24%', 'Super Starter Feed 24%', '24%', 'poultry', 'starter_24');

-- ============================================
-- 2. INSERT FEED PRICING (48 records - 16 types × 3 sizes)
-- ============================================

-- FT001 - Super Starter 23%
INSERT INTO feed_pricing (feed_type_id, package_size, cost_price, selling_price_7, selling_price_75, selling_price_8, max_price) VALUES
(1, 10, 193196, 206720, 207690, 212210, 214210),
(1, 25, 482991, 516800, 519225, 530525, 535525),
(1, 50, 965981, 1033600, 1038450, 1061050, 1071050);

-- FT002 - Super Grower 21%
INSERT INTO feed_pricing (feed_type_id, package_size, cost_price, selling_price_7, selling_price_75, selling_price_8, max_price) VALUES
(2, 10, 191290, 204680, 205640, 210440, 212440),
(2, 25, 478224, 511700, 514100, 526100, 531100),
(2, 50, 956449, 1023400, 1028200, 1052200, 1062200);

-- FT003 - Super Finisher 19%
INSERT INTO feed_pricing (feed_type_id, package_size, cost_price, selling_price_7, selling_price_75, selling_price_8, max_price) VALUES
(3, 10, 187551, 200680, 201620, 206690, 208690),
(3, 25, 468879, 501700, 504050, 516725, 521725),
(3, 50, 937757, 1003400, 1008100, 1033450, 1043450);

-- FT004 - Broiler Starter-Grower 21%
INSERT INTO feed_pricing (feed_type_id, package_size, cost_price, selling_price_7, selling_price_75, selling_price_8, max_price) VALUES
(4, 10, 181421, 194120, 195030, 199250, 201250),
(4, 25, 453552, 485300, 487575, 498125, 503125),
(4, 50, 907103, 970600, 975150, 996250, 1006250);

-- FT005 - Layer Starter 20%
INSERT INTO feed_pricing (feed_type_id, package_size, cost_price, selling_price_7, selling_price_75, selling_price_8, max_price) VALUES
(5, 10, 182187, 194940, 195850, 200240, 202240),
(5, 25, 455467, 487350, 489625, 500600, 505600),
(5, 50, 910935, 974700, 979250, 1001200, 1011200);

-- FT006 - Layer Grower 1 (18%)
INSERT INTO feed_pricing (feed_type_id, package_size, cost_price, selling_price_7, selling_price_75, selling_price_8, max_price) VALUES
(6, 10, 175234, 187500, 188370, 192770, 194770),
(6, 25, 438084, 468750, 470925, 481925, 486925),
(6, 50, 876168, 937500, 941850, 963850, 973850);

-- FT007 - Layer Grower 2 (16%)
INSERT INTO feed_pricing (feed_type_id, package_size, cost_price, selling_price_7, selling_price_75, selling_price_8, max_price) VALUES
(7, 10, 165514, 177100, 177930, 182400, 184400),
(7, 25, 413785, 442750, 444825, 456000, 461000),
(7, 50, 827570, 885500, 889650, 912000, 922000);

-- FT008 - Layer Pre-Lay 17.5%
INSERT INTO feed_pricing (feed_type_id, package_size, cost_price, selling_price_7, selling_price_75, selling_price_8, max_price) VALUES
(8, 10, 160280, 171500, 180920, 185340, 187340),
(8, 25, 400700, 428750, 452300, 463350, 468350),
(8, 50, 801401, 857500, 904600, 926700, 936700);

-- FT009 - Layer Production 18%
INSERT INTO feed_pricing (feed_type_id, package_size, cost_price, selling_price_7, selling_price_75, selling_price_8, max_price) VALUES
(9, 10, 155607, 166500, 178210, 182390, 184390),
(9, 25, 389019, 416250, 445525, 455975, 460975),
(9, 50, 778037, 832500, 891050, 911950, 921950);

-- FT010 - Layer Production 17%
INSERT INTO feed_pricing (feed_type_id, package_size, cost_price, selling_price_7, selling_price_75, selling_price_8, max_price) VALUES
(10, 10, 153738, 164500, 176080, 180380, 182380),
(10, 25, 384346, 411250, 440200, 450950, 455950),
(10, 50, 768692, 822500, 880400, 901900, 911900);

-- FT011 - Layer Production 16%
INSERT INTO feed_pricing (feed_type_id, package_size, cost_price, selling_price_7, selling_price_75, selling_price_8, max_price) VALUES
(11, 10, 151869, 162500, 171630, 175940, 177940),
(11, 25, 379673, 406250, 429075, 439850, 444850),
(11, 50, 759346, 812500, 858150, 879700, 889700);

-- FT012 - Layer Production 14%
INSERT INTO feed_pricing (feed_type_id, package_size, cost_price, selling_price_7, selling_price_75, selling_price_8, max_price) VALUES
(12, 10, 148648, 159000, 162900, 166880, 168880),
(12, 25, 371620, 397500, 407250, 417200, 422200),
(12, 50, 743240, 795000, 814500, 834400, 844400);

-- FT013 - Duck Starter 22%
INSERT INTO feed_pricing (feed_type_id, package_size, cost_price, selling_price_7, selling_price_75, selling_price_8, max_price) VALUES
(13, 10, 189800, 203100, 204000, 208950, 210950),
(13, 25, 474500, 507750, 510000, 522375, 527375),
(13, 50, 949000, 1015500, 1020000, 1044750, 1054750);

-- FT014 - Duck Grower 18%
INSERT INTO feed_pricing (feed_type_id, package_size, cost_price, selling_price_7, selling_price_75, selling_price_8, max_price) VALUES
(14, 10, 175000, 187250, 188100, 192600, 194600),
(14, 25, 437500, 468125, 470250, 481500, 486500),
(14, 50, 875000, 936250, 940500, 963000, 973000);

-- FT015 - Home Broiler 21%
INSERT INTO feed_pricing (feed_type_id, package_size, cost_price, selling_price_7, selling_price_75, selling_price_8, max_price) VALUES
(15, 10, 183200, 196024, 196950, 201456, 203456),
(15, 25, 458000, 490060, 492375, 503640, 508640),
(15, 50, 916000, 980120, 984750, 1007280, 1017280);

-- FT016 - Super Starter 24%
INSERT INTO feed_pricing (feed_type_id, package_size, cost_price, selling_price_7, selling_price_75, selling_price_8, max_price) VALUES
(16, 10, 201500, 215605, 216600, 221720, 223720),
(16, 25, 503750, 539012, 541500, 554300, 559300),
(16, 50, 1007500, 1078025, 1083000, 1108600, 1118600);

-- ============================================
-- 3. INSERT RAW MATERIALS (23 ingredients)
-- ============================================

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
('RM025', 'شكاير', 'Bags/Sacks', 'packaging', 13.00, 10000, 1000, 2000);

SELECT 'Feed types, pricing, and raw materials inserted successfully' as status;
