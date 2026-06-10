-- Al Kheir Feed Factory - Recipe Data Migration
-- Extracted from al kheir pricing - 7-10.csv
-- All quantities are per 1000kg (1 ton) of finished feed

-- ============================================
-- 4. INSERT FEED RECIPES (16 recipes)
-- ============================================

INSERT INTO feed_recipes (feed_type_id, version, name, total_quantity_kg, total_cost) VALUES
(1, 1, 'Super Starter 23% Recipe', 1000, 18194.77),
(2, 1, 'Super Grower 21% Recipe', 1000, 18030.80),
(3, 1, 'Super Finisher 19% Recipe', 1000, 17683.65),
(4, 1, 'Broiler Starter-Grower 21% Recipe', 1000, 16994.70),
(5, 1, 'Layer Starter 20% Recipe', 1000, 17086.39),
(6, 1, 'Layer Grower 1 (18%) Recipe', 1000, 16394.64),
(7, 1, 'Layer Grower 2 (16%) Recipe', 1000, 15434.74),
(8, 1, 'Layer Pre-Lay 17.5% Recipe', 1000, 15706.60),
(9, 1, 'Layer Production 18% Recipe', 1000, 15433.20),
(10, 1, 'Layer Production 17% Recipe', 1000, 15247.20),
(11, 1, 'Layer Production 16% Recipe', 1000, 14836.60),
(12, 1, 'Layer Production 14% Recipe', 1000, 14090.85),
(13, 1, 'Duck Starter 22% Recipe', 1000, 17408.99),
(14, 1, 'Duck Grower 18% Recipe', 1000, 17015.14),
(15, 1, 'Home Broiler 21% Recipe', 1000, 16497.60),
(16, 1, 'Super Starter 24% Recipe', 1000, 19328.30);

-- ============================================
-- 5. INSERT RECIPE ITEMS (Ingredients per Recipe)
-- ============================================

-- Recipe 1: Super Starter 23% (ID: 1)
INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost) VALUES
(1, 1, 573.00, 56.17, 8595.00),    -- Corn
(1, 2, 352.00, 34.50, 6811.20),    -- Soybean 46%
(1, 3, 0.00, 0.00, 0.00),          -- Wheat Bran (not used)
(1, 4, 5.00, 0.49, 192.50),        -- Gluten
(1, 5, 0.00, 0.00, 0.00),          -- Soybean Oil (not used)
(1, 6, 30.00, 2.94, 360.00),       -- Chaff
(1, 7, 3.00, 0.29, 450.00),        -- Methionine
(1, 8, 2.50, 0.25, 250.00),        -- Lysine
(1, 9, 11.00, 1.08, 495.00),       -- Mono Calcium
(1, 10, 12.70, 1.24, 7.62),        -- Limestone
(1, 11, 2.50, 0.25, 235.00),       -- Premix
(1, 12, 3.00, 0.29, 5.40),         -- Salt
(1, 13, 1.30, 0.13, 33.80),        -- Sodium Bicarbonate
(1, 14, 1.00, 0.10, 20.00),        -- Adsorbent
(1, 15, 0.25, 0.02, 50.00),        -- Mycotoxin Binder
(1, 16, 0.80, 0.08, 76.00),        -- Threonine
(1, 17, 0.20, 0.02, 58.00),        -- Fat Emulsion
(1, 18, 0.50, 0.05, 40.00),        -- Mediora Mycin
(1, 19, 0.35, 0.03, 92.75),        -- Tri-Boot 3
(1, 20, 0.125, 0.01, 50.00),       -- Phytase
(1, 21, 0.70, 0.07, 52.50),        -- Betaine
(1, 22, 0.00, 0.00, 0.00),         -- Sepenza (not used)
(1, 23, 0.30, 0.03, 60.00),        -- Energy Enzyme
(1, 24, 0.00, 0.00, 0.00),         -- Biody (not used)
(1, 25, 20.00, 1.96, 260.00);      -- Bags

-- Recipe 2: Super Grower 21% (ID: 2)
INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost) VALUES
(2, 1, 620.00, 60.77, 9300.00),    -- Corn
(2, 2, 323.00, 31.66, 6250.05),    -- Soybean 46%
(2, 3, 0.00, 0.00, 0.00),          -- Wheat Bran (not used)
(2, 4, 5.00, 0.49, 192.50),        -- Gluten
(2, 5, 0.00, 0.00, 0.00),          -- Soybean Oil (not used)
(2, 6, 20.00, 1.96, 240.00),       -- Chaff
(2, 7, 3.00, 0.29, 450.00),        -- Methionine
(2, 8, 2.20, 0.22, 220.00),        -- Lysine
(2, 9, 8.50, 0.83, 382.50),        -- Mono Calcium
(2, 10, 8.00, 0.78, 4.80),         -- Limestone
(2, 11, 2.25, 0.22, 211.50),       -- Premix
(2, 12, 3.00, 0.29, 5.40),         -- Salt
(2, 13, 1.30, 0.13, 33.80),        -- Sodium Bicarbonate
(2, 14, 1.00, 0.10, 20.00),        -- Adsorbent
(2, 15, 0.25, 0.02, 50.00),        -- Mycotoxin Binder
(2, 16, 0.60, 0.06, 57.00),        -- Threonine
(2, 17, 0.20, 0.02, 58.00),        -- Fat Emulsion
(2, 18, 0.50, 0.05, 40.00),        -- Mediora Mycin
(2, 19, 0.35, 0.03, 92.75),        -- Tri-Boot 3
(2, 20, 0.125, 0.01, 50.00),       -- Phytase
(2, 21, 0.70, 0.07, 52.50),        -- Betaine
(2, 22, 0.00, 0.00, 0.00),         -- Sepenza (not used)
(2, 23, 0.30, 0.03, 60.00),        -- Energy Enzyme
(2, 24, 0.00, 0.00, 0.00),         -- Biody (not used)
(2, 25, 20.00, 1.96, 260.00);      -- Bags

-- Recipe 3: Super Finisher 19% (ID: 3)
INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost) VALUES
(3, 1, 666.00, 65.28, 9990.00),    -- Corn
(3, 2, 270.00, 26.47, 5224.50),    -- Soybean 46%
(3, 3, 0.00, 0.00, 0.00),          -- Wheat Bran (not used)
(3, 4, 5.00, 0.49, 192.50),        -- Gluten
(3, 5, 0.00, 0.00, 0.00),          -- Soybean Oil (not used)
(3, 6, 30.00, 2.94, 360.00),       -- Chaff
(3, 7, 2.80, 0.27, 420.00),        -- Methionine
(3, 8, 2.10, 0.21, 210.00),        -- Lysine
(3, 9, 7.00, 0.69, 315.00),        -- Mono Calcium
(3, 10, 7.00, 0.69, 4.20),         -- Limestone
(3, 11, 2.00, 0.20, 188.00),       -- Premix
(3, 12, 3.00, 0.29, 5.40),         -- Salt
(3, 13, 1.30, 0.13, 33.80),        -- Sodium Bicarbonate
(3, 14, 1.00, 0.10, 20.00),        -- Adsorbent
(3, 15, 0.25, 0.02, 50.00),        -- Mycotoxin Binder
(3, 16, 0.60, 0.06, 57.00),        -- Threonine
(3, 17, 0.20, 0.02, 58.00),        -- Fat Emulsion
(3, 18, 0.50, 0.05, 40.00),        -- Mediora Mycin
(3, 19, 0.35, 0.03, 92.75),        -- Tri-Boot 3
(3, 20, 0.125, 0.01, 50.00),       -- Phytase
(3, 21, 0.70, 0.07, 52.50),        -- Betaine
(3, 22, 0.00, 0.00, 0.00),         -- Sepenza (not used)
(3, 23, 0.30, 0.03, 60.00),        -- Energy Enzyme
(3, 24, 0.00, 0.00, 0.00),         -- Biody (not used)
(3, 25, 20.00, 1.96, 260.00);      -- Bags

-- Recipe 4: Broiler Starter-Grower 21% (ID: 4)
INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost) VALUES
(4, 1, 534.00, 52.34, 8010.00),    -- Corn
(4, 2, 300.00, 29.41, 5805.00),    -- Soybean 46%
(4, 3, 100.00, 9.80, 1080.00),     -- Wheat Bran
(4, 4, 0.00, 0.00, 0.00),          -- Gluten (not used)
(4, 5, 0.00, 0.00, 0.00),          -- Soybean Oil (not used)
(4, 6, 30.00, 2.94, 360.00),       -- Chaff
(4, 7, 2.00, 0.20, 300.00),        -- Methionine
(4, 8, 2.00, 0.20, 200.00),        -- Lysine
(4, 9, 10.50, 1.03, 472.50),       -- Mono Calcium
(4, 10, 12.50, 1.23, 7.50),        -- Limestone
(4, 11, 2.00, 0.20, 188.00),       -- Premix
(4, 12, 3.00, 0.29, 5.40),         -- Salt
(4, 13, 1.30, 0.13, 33.80),        -- Sodium Bicarbonate
(4, 14, 1.00, 0.10, 20.00),        -- Adsorbent
(4, 15, 0.25, 0.02, 50.00),        -- Mycotoxin Binder
(4, 16, 0.00, 0.00, 0.00),         -- Threonine (not used)
(4, 17, 0.00, 0.00, 0.00),         -- Fat Emulsion (not used)
(4, 18, 0.50, 0.05, 40.00),        -- Mediora Mycin
(4, 19, 0.00, 0.00, 0.00),         -- Tri-Boot 3 (not used)
(4, 20, 0.125, 0.01, 50.00),       -- Phytase
(4, 21, 0.70, 0.07, 52.50),        -- Betaine
(4, 22, 0.00, 0.00, 0.00),         -- Sepenza (not used)
(4, 23, 0.30, 0.03, 60.00),        -- Energy Enzyme
(4, 24, 0.00, 0.00, 0.00),         -- Biody (not used)
(4, 25, 20.00, 1.96, 260.00);      -- Bags

-- Recipe 5: Layer Starter 20% (ID: 5)
INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost) VALUES
(5, 1, 560.00, 54.90, 8400.00),    -- Corn
(5, 2, 279.00, 27.35, 5398.65),    -- Soybean 46%
(5, 3, 115.00, 11.27, 1242.00),    -- Wheat Bran
(5, 4, 10.00, 0.98, 385.00),       -- Gluten
(5, 5, 0.00, 0.00, 0.00),          -- Soybean Oil (not used)
(5, 6, 0.00, 0.00, 0.00),          -- Chaff (not used)
(5, 7, 2.00, 0.20, 300.00),        -- Methionine
(5, 8, 1.50, 0.15, 150.00),        -- Lysine
(5, 9, 11.00, 1.08, 495.00),       -- Mono Calcium
(5, 10, 12.50, 1.23, 7.50),        -- Limestone
(5, 11, 2.00, 0.20, 188.00),       -- Premix
(5, 12, 3.30, 0.32, 5.94),         -- Salt
(5, 13, 1.30, 0.13, 33.80),        -- Sodium Bicarbonate
(5, 14, 1.00, 0.10, 20.00),        -- Adsorbent
(5, 15, 0.00, 0.00, 0.00),         -- Mycotoxin Binder (not used)
(5, 16, 0.40, 0.04, 38.00),        -- Threonine
(5, 17, 0.00, 0.00, 0.00),         -- Fat Emulsion (not used)
(5, 18, 0.00, 0.00, 0.00),         -- Mediora Mycin (not used)
(5, 19, 0.00, 0.00, 0.00),         -- Tri-Boot 3 (not used)
(5, 20, 0.125, 0.01, 50.00),       -- Phytase
(5, 21, 0.70, 0.07, 52.50),        -- Betaine
(5, 22, 0.00, 0.00, 0.00),         -- Sepenza (not used)
(5, 23, 0.30, 0.03, 60.00),        -- Energy Enzyme
(5, 24, 0.00, 0.00, 0.00),         -- Biody (not used)
(5, 25, 20.00, 1.96, 260.00);      -- Bags

-- Recipe 6: Layer Grower 1 (18%) (ID: 6)
INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost) VALUES
(6, 1, 567.00, 55.59, 8505.00),    -- Corn
(6, 2, 230.00, 22.55, 4450.50),    -- Soybean 46%
(6, 3, 160.00, 15.69, 1728.00),    -- Wheat Bran
(6, 4, 10.00, 0.98, 385.00),       -- Gluten
(6, 5, 0.00, 0.00, 0.00),          -- Soybean Oil (not used)
(6, 6, 0.00, 0.00, 0.00),          -- Chaff (not used)
(6, 7, 1.25, 0.12, 187.50),        -- Methionine
(6, 8, 1.00, 0.10, 100.00),        -- Lysine
(6, 9, 8.00, 0.78, 360.00),        -- Mono Calcium
(6, 10, 14.00, 1.37, 8.40),        -- Limestone
(6, 11, 2.00, 0.20, 188.00),       -- Premix
(6, 12, 3.30, 0.32, 5.94),         -- Salt
(6, 13, 1.30, 0.13, 33.80),        -- Sodium Bicarbonate
(6, 14, 1.00, 0.10, 20.00),        -- Adsorbent
(6, 15, 0.00, 0.00, 0.00),         -- Mycotoxin Binder (not used)
(6, 16, 0.00, 0.00, 0.00),         -- Threonine (not used)
(6, 17, 0.00, 0.00, 0.00),         -- Fat Emulsion (not used)
(6, 18, 0.00, 0.00, 0.00),         -- Mediora Mycin (not used)
(6, 19, 0.00, 0.00, 0.00),         -- Tri-Boot 3 (not used)
(6, 20, 0.125, 0.01, 50.00),       -- Phytase
(6, 21, 0.70, 0.07, 52.50),        -- Betaine
(6, 22, 0.00, 0.00, 0.00),         -- Sepenza (not used)
(6, 23, 0.30, 0.03, 60.00),        -- Energy Enzyme
(6, 24, 0.00, 0.00, 0.00),         -- Biody (not used)
(6, 25, 20.00, 1.96, 260.00);      -- Bags

-- Recipe 7: Layer Grower 2 (16%) (ID: 7)
INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost) VALUES
(7, 1, 588.00, 57.64, 8820.00),    -- Corn
(7, 2, 160.00, 15.69, 3096.00),    -- Soybean 46%
(7, 3, 222.00, 21.77, 2397.60),    -- Wheat Bran
(7, 4, 0.00, 0.00, 0.00),          -- Gluten (not used)
(7, 5, 0.00, 0.00, 0.00),          -- Soybean Oil (not used)
(7, 6, 0.00, 0.00, 0.00),          -- Chaff (not used)
(7, 7, 1.00, 0.10, 150.00),        -- Methionine
(7, 8, 0.00, 0.00, 0.00),          -- Lysine (not used)
(7, 9, 6.50, 0.64, 292.50),        -- Mono Calcium
(7, 10, 14.00, 1.37, 8.40),        -- Limestone
(7, 11, 2.00, 0.20, 188.00),       -- Premix
(7, 12, 3.30, 0.32, 5.94),         -- Salt
(7, 13, 1.30, 0.13, 33.80),        -- Sodium Bicarbonate
(7, 14, 1.00, 0.10, 20.00),        -- Adsorbent
(7, 15, 0.00, 0.00, 0.00),         -- Mycotoxin Binder (not used)
(7, 16, 0.00, 0.00, 0.00),         -- Threonine (not used)
(7, 17, 0.00, 0.00, 0.00),         -- Fat Emulsion (not used)
(7, 18, 0.00, 0.00, 0.00),         -- Mediora Mycin (not used)
(7, 19, 0.00, 0.00, 0.00),         -- Tri-Boot 3 (not used)
(7, 20, 0.125, 0.01, 50.00),       -- Phytase
(7, 21, 0.70, 0.07, 52.50),        -- Betaine
(7, 22, 0.00, 0.00, 0.00),         -- Sepenza (not used)
(7, 23, 0.30, 0.03, 60.00),        -- Energy Enzyme
(7, 24, 0.00, 0.00, 0.00),         -- Biody (not used)
(7, 25, 20.00, 1.96, 260.00);      -- Bags

-- Recipe 8: Layer Pre-Lay 17.5% (ID: 8)
INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost) VALUES
(8, 1, 576.00, 56.48, 8640.00),    -- Corn
(8, 2, 220.00, 21.57, 4257.00),    -- Soybean 46%
(8, 3, 140.00, 13.73, 1512.00),    -- Wheat Bran
(8, 4, 0.00, 0.00, 0.00),          -- Gluten (not used)
(8, 5, 0.00, 0.00, 0.00),          -- Soybean Oil (not used)
(8, 6, 0.00, 0.00, 0.00),          -- Chaff (not used)
(8, 7, 1.00, 0.10, 150.00),        -- Methionine
(8, 8, 0.00, 0.00, 0.00),          -- Lysine (not used)
(8, 9, 10.00, 0.98, 450.00),       -- Mono Calcium
(8, 10, 45.00, 4.41, 27.00),       -- Limestone
(8, 11, 2.00, 0.20, 188.00),       -- Premix
(8, 12, 3.50, 0.34, 6.30),         -- Salt
(8, 13, 1.30, 0.13, 33.80),        -- Sodium Bicarbonate
(8, 14, 1.00, 0.10, 20.00),        -- Adsorbent
(8, 15, 0.00, 0.00, 0.00),         -- Mycotoxin Binder (not used)
(8, 16, 0.00, 0.00, 0.00),         -- Threonine (not used)
(8, 17, 0.00, 0.00, 0.00),         -- Fat Emulsion (not used)
(8, 18, 0.00, 0.00, 0.00),         -- Mediora Mycin (not used)
(8, 19, 0.00, 0.00, 0.00),         -- Tri-Boot 3 (not used)
(8, 20, 0.125, 0.01, 50.00),       -- Phytase
(8, 21, 0.70, 0.07, 52.50),        -- Betaine
(8, 22, 0.00, 0.00, 0.00),         -- Sepenza (not used)
(8, 23, 0.30, 0.03, 60.00),        -- Energy Enzyme
(8, 24, 0.00, 0.00, 0.00),         -- Biody (not used)
(8, 25, 20.00, 1.96, 260.00);      -- Bags

SELECT 'Recipes 1-8 inserted successfully' as status;
