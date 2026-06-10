-- Al Kheir Feed Factory - Recipe Data Migration Part 2 (Recipes 9-16)
-- Extracted from al kheir pricing - 7-10.csv

-- Recipe 9: Layer Production 18% (ID: 9)
INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost) VALUES
(9, 1, 540.00, 52.94, 8100.00),    -- Corn
(9, 2, 240.00, 23.53, 4644.00),    -- Soybean 46%
(9, 3, 100.00, 9.80, 1080.00),     -- Wheat Bran
(9, 4, 5.00, 0.49, 192.50),        -- Gluten
(9, 5, 0.00, 0.00, 0.00),          -- Soybean Oil (not used)
(9, 6, 0.00, 0.00, 0.00),          -- Chaff (not used)
(9, 7, 1.60, 0.16, 240.00),        -- Methionine
(9, 8, 0.00, 0.00, 0.00),          -- Lysine (not used)
(9, 9, 10.00, 0.98, 450.00),       -- Mono Calcium
(9, 10, 95.00, 9.31, 57.00),       -- Limestone
(9, 11, 2.00, 0.20, 188.00),       -- Premix
(9, 12, 3.00, 0.29, 5.40),         -- Salt
(9, 13, 1.30, 0.13, 33.80),        -- Sodium Bicarbonate
(9, 14, 1.00, 0.10, 20.00),        -- Adsorbent
(9, 15, 0.00, 0.00, 0.00),         -- Mycotoxin Binder (not used)
(9, 16, 0.00, 0.00, 0.00),         -- Threonine (not used)
(9, 17, 0.00, 0.00, 0.00),         -- Fat Emulsion (not used)
(9, 18, 0.00, 0.00, 0.00),         -- Mediora Mycin (not used)
(9, 19, 0.00, 0.00, 0.00),         -- Tri-Boot 3 (not used)
(9, 20, 0.125, 0.01, 50.00),       -- Phytase
(9, 21, 0.70, 0.07, 52.50),        -- Betaine
(9, 22, 0.00, 0.00, 0.00),         -- Sepenza (not used)
(9, 23, 0.30, 0.03, 60.00),        -- Energy Enzyme
(9, 24, 0.00, 0.00, 0.00),         -- Biody (not used)
(9, 25, 20.00, 1.96, 260.00);      -- Bags

-- Recipe 10: Layer Production 17% (ID: 10)
INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost) VALUES
(10, 1, 560.00, 54.90, 8400.00),   -- Corn
(10, 2, 220.00, 21.57, 4257.00),   -- Soybean 46%
(10, 3, 99.00, 9.71, 1069.20),     -- Wheat Bran
(10, 4, 5.00, 0.49, 192.50),       -- Gluten
(10, 5, 0.00, 0.00, 0.00),         -- Soybean Oil (not used)
(10, 6, 0.00, 0.00, 0.00),         -- Chaff (not used)
(10, 7, 1.60, 0.16, 240.00),       -- Methionine
(10, 8, 0.00, 0.00, 0.00),         -- Lysine (not used)
(10, 9, 8.00, 0.78, 360.00),       -- Mono Calcium
(10, 10, 98.00, 9.61, 58.80),      -- Limestone
(10, 11, 2.00, 0.20, 188.00),      -- Premix
(10, 12, 3.00, 0.29, 5.40),        -- Salt
(10, 13, 1.30, 0.13, 33.80),       -- Sodium Bicarbonate
(10, 14, 1.00, 0.10, 20.00),       -- Adsorbent
(10, 15, 0.00, 0.00, 0.00),        -- Mycotoxin Binder (not used)
(10, 16, 0.00, 0.00, 0.00),        -- Threonine (not used)
(10, 17, 0.00, 0.00, 0.00),        -- Fat Emulsion (not used)
(10, 18, 0.00, 0.00, 0.00),        -- Mediora Mycin (not used)
(10, 19, 0.00, 0.00, 0.00),        -- Tri-Boot 3 (not used)
(10, 20, 0.125, 0.01, 50.00),      -- Phytase
(10, 21, 0.70, 0.07, 52.50),       -- Betaine
(10, 22, 0.00, 0.00, 0.00),        -- Sepenza (not used)
(10, 23, 0.30, 0.03, 60.00),       -- Energy Enzyme
(10, 24, 0.00, 0.00, 0.00),        -- Biody (not used)
(10, 25, 20.00, 1.96, 260.00);     -- Bags

-- Recipe 11: Layer Production 16% (ID: 11)
INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost) VALUES
(11, 1, 566.00, 55.49, 8490.00),   -- Corn
(11, 2, 200.00, 19.61, 3870.00),   -- Soybean 46%
(11, 3, 118.00, 11.57, 1274.40),   -- Wheat Bran
(11, 4, 0.00, 0.00, 0.00),         -- Gluten (not used)
(11, 5, 0.00, 0.00, 0.00),         -- Soybean Oil (not used)
(11, 6, 0.00, 0.00, 0.00),         -- Chaff (not used)
(11, 7, 1.20, 0.12, 180.00),       -- Methionine
(11, 8, 0.50, 0.05, 50.00),        -- Lysine
(11, 9, 6.50, 0.64, 292.50),       -- Mono Calcium
(11, 10, 100.00, 9.80, 60.00),     -- Limestone
(11, 11, 2.00, 0.20, 188.00),      -- Premix
(11, 12, 3.00, 0.29, 5.40),        -- Salt
(11, 13, 1.30, 0.13, 33.80),       -- Sodium Bicarbonate
(11, 14, 1.00, 0.10, 20.00),       -- Adsorbent
(11, 15, 0.00, 0.00, 0.00),        -- Mycotoxin Binder (not used)
(11, 16, 0.00, 0.00, 0.00),        -- Threonine (not used)
(11, 17, 0.00, 0.00, 0.00),        -- Fat Emulsion (not used)
(11, 18, 0.00, 0.00, 0.00),        -- Mediora Mycin (not used)
(11, 19, 0.00, 0.00, 0.00),        -- Tri-Boot 3 (not used)
(11, 20, 0.125, 0.01, 50.00),      -- Phytase
(11, 21, 0.70, 0.07, 52.50),       -- Betaine
(11, 22, 0.00, 0.00, 0.00),        -- Sepenza (not used)
(11, 23, 0.30, 0.03, 60.00),       -- Energy Enzyme
(11, 24, 0.00, 0.00, 0.00),        -- Biody (not used)
(11, 25, 20.00, 1.96, 260.00);     -- Bags

-- Recipe 12: Layer Production 14% (ID: 12)
INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost) VALUES
(12, 1, 575.00, 56.37, 8625.00),   -- Corn
(12, 2, 115.00, 11.27, 2225.25),   -- Soybean 46%
(12, 3, 190.00, 18.63, 2052.00),   -- Wheat Bran
(12, 4, 0.00, 0.00, 0.00),         -- Gluten (not used)
(12, 5, 0.00, 0.00, 0.00),         -- Soybean Oil (not used)
(12, 6, 0.00, 0.00, 0.00),         -- Chaff (not used)
(12, 7, 1.20, 0.12, 180.00),       -- Methionine
(12, 8, 0.20, 0.02, 20.00),        -- Lysine
(12, 9, 5.00, 0.49, 225.00),       -- Mono Calcium
(12, 10, 105.00, 10.29, 63.00),    -- Limestone
(12, 11, 2.00, 0.20, 188.00),      -- Premix
(12, 12, 3.50, 0.34, 6.30),        -- Salt
(12, 13, 1.30, 0.13, 33.80),       -- Sodium Bicarbonate
(12, 14, 1.00, 0.10, 20.00),       -- Adsorbent
(12, 15, 0.00, 0.00, 0.00),        -- Mycotoxin Binder (not used)
(12, 16, 0.00, 0.00, 0.00),        -- Threonine (not used)
(12, 17, 0.00, 0.00, 0.00),        -- Fat Emulsion (not used)
(12, 18, 0.00, 0.00, 0.00),        -- Mediora Mycin (not used)
(12, 19, 0.00, 0.00, 0.00),        -- Tri-Boot 3 (not used)
(12, 20, 0.125, 0.01, 50.00),      -- Phytase
(12, 21, 0.70, 0.07, 52.50),       -- Betaine
(12, 22, 0.00, 0.00, 0.00),        -- Sepenza (not used)
(12, 23, 0.30, 0.03, 60.00),       -- Energy Enzyme
(12, 24, 0.00, 0.00, 0.00),        -- Biody (not used)
(12, 25, 20.00, 1.96, 260.00);     -- Bags

-- Recipe 13: Duck Starter 22% (ID: 13)
INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost) VALUES
(13, 1, 653.00, 64.00, 9795.00),   -- Corn
(13, 2, 355.00, 34.80, 6869.25),   -- Soybean 46%
(13, 3, 25.00, 2.45, 270.00),      -- Wheat Bran
(13, 4, 0.00, 0.00, 0.00),         -- Gluten (not used)
(13, 5, 5.00, 0.49, 250.00),       -- Soybean Oil
(13, 6, 0.00, 0.00, 0.00),         -- Chaff (not used)
(13, 7, 1.50, 0.15, 225.00),       -- Methionine
(13, 8, 0.20, 0.02, 20.00),        -- Lysine
(13, 9, 11.00, 1.08, 495.00),      -- Mono Calcium
(13, 10, 14.00, 1.37, 8.40),       -- Limestone
(13, 11, 2.00, 0.20, 188.00),      -- Premix
(13, 12, 2.80, 0.27, 5.04),        -- Salt
(13, 13, 1.30, 0.13, 33.80),       -- Sodium Bicarbonate
(13, 14, 1.00, 0.10, 20.00),       -- Adsorbent
(13, 15, 0.25, 0.02, 50.00),       -- Mycotoxin Binder
(13, 16, 0.20, 0.02, 19.00),       -- Threonine
(13, 17, 0.20, 0.02, 58.00),       -- Fat Emulsion
(13, 18, 0.50, 0.05, 40.00),       -- Mediora Mycin
(13, 19, 0.00, 0.00, 0.00),        -- Tri-Boot 3 (not used)
(13, 20, 0.125, 0.01, 50.00),      -- Phytase
(13, 21, 0.70, 0.07, 52.50),       -- Betaine
(13, 22, 0.10, 0.01, 45.00),       -- Sepenza
(13, 23, 0.30, 0.03, 60.00),       -- Energy Enzyme
(13, 24, 0.10, 0.01, 45.00),       -- Biody
(13, 25, 20.00, 1.96, 260.00);     -- Bags

-- Recipe 14: Duck Grower 18% (ID: 14)
INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost) VALUES
(14, 1, 540.00, 52.94, 8100.00),   -- Corn
(14, 2, 280.00, 27.45, 5418.00),   -- Soybean 46%
(14, 3, 40.00, 3.92, 432.00),      -- Wheat Bran
(14, 4, 0.00, 0.00, 0.00),         -- Gluten (not used)
(14, 5, 0.00, 0.00, 0.00),         -- Soybean Oil (not used)
(14, 6, 0.00, 0.00, 0.00),         -- Chaff (not used)
(14, 7, 1.70, 0.17, 255.00),       -- Methionine
(14, 8, 0.30, 0.03, 30.00),        -- Lysine
(14, 9, 8.50, 0.83, 382.50),       -- Mono Calcium
(14, 10, 8.00, 0.78, 4.80),        -- Limestone
(14, 11, 2.00, 0.20, 188.00),      -- Premix
(14, 12, 2.80, 0.27, 5.04),        -- Salt
(14, 13, 1.30, 0.13, 33.80),       -- Sodium Bicarbonate
(14, 14, 1.00, 0.10, 20.00),       -- Adsorbent
(14, 15, 0.00, 0.00, 0.00),        -- Mycotoxin Binder (not used)
(14, 16, 0.30, 0.03, 28.50),       -- Threonine
(14, 17, 0.00, 0.00, 0.00),        -- Fat Emulsion (not used)
(14, 18, 0.50, 0.05, 40.00),       -- Mediora Mycin
(14, 19, 0.00, 0.00, 0.00),        -- Tri-Boot 3 (not used)
(14, 20, 0.125, 0.01, 50.00),      -- Phytase
(14, 21, 0.70, 0.07, 52.50),       -- Betaine
(14, 22, 0.00, 0.00, 0.00),        -- Sepenza (not used)
(14, 23, 0.30, 0.03, 60.00),       -- Energy Enzyme
(14, 24, 0.00, 0.00, 0.00),        -- Biody (not used)
(14, 25, 20.00, 1.96, 260.00);     -- Bags

-- Recipe 15: Home Broiler 21% (ID: 15)
INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost) VALUES
(15, 1, 550.00, 53.92, 8250.00),   -- Corn
(15, 2, 266.00, 26.08, 5147.10),   -- Soybean 46%
(15, 3, 160.00, 15.68, 1728.00),   -- Wheat Bran
(15, 4, 30.00, 2.94, 1155.00),     -- Gluten
(15, 5, 0.00, 0.00, 0.00),         -- Soybean Oil (not used)
(15, 6, 0.00, 0.00, 0.00),         -- Chaff (not used)
(15, 7, 1.60, 0.16, 240.00),       -- Methionine
(15, 8, 1.60, 0.16, 160.00),       -- Lysine
(15, 9, 9.00, 0.88, 405.00),       -- Mono Calcium
(15, 10, 13.00, 1.27, 7.80),       -- Limestone
(15, 11, 2.00, 0.20, 188.00),      -- Premix
(15, 12, 3.00, 0.29, 5.40),        -- Salt
(15, 13, 1.30, 0.13, 33.80),       -- Sodium Bicarbonate
(15, 14, 1.00, 0.10, 20.00),       -- Adsorbent
(15, 15, 0.00, 0.00, 0.00),        -- Mycotoxin Binder (not used)
(15, 16, 0.00, 0.00, 0.00),        -- Threonine (not used)
(15, 17, 0.00, 0.00, 0.00),        -- Fat Emulsion (not used)
(15, 18, 0.50, 0.05, 40.00),       -- Mediora Mycin
(15, 19, 0.00, 0.00, 0.00),        -- Tri-Boot 3 (not used)
(15, 20, 0.125, 0.01, 50.00),      -- Phytase
(15, 21, 0.70, 0.07, 52.50),       -- Betaine
(15, 22, 0.00, 0.00, 0.00),        -- Sepenza (not used)
(15, 23, 0.30, 0.03, 60.00),       -- Energy Enzyme
(15, 24, 0.00, 0.00, 0.00),        -- Biody (not used)
(15, 25, 20.00, 1.96, 260.00);     -- Bags

-- Recipe 16: Super Starter 24% (ID: 16)
INSERT INTO feed_recipe_items (recipe_id, raw_material_id, quantity_kg, percentage, unit_cost) VALUES
(16, 1, 373.00, 36.60, 5595.00),   -- Corn
(16, 2, 373.00, 36.60, 7217.55),   -- Soybean 46%
(16, 3, 0.00, 0.00, 0.00),         -- Wheat Bran (not used)
(16, 4, 0.00, 0.00, 0.00),         -- Gluten (not used)
(16, 5, 0.00, 0.00, 0.00),         -- Soybean Oil (not used)
(16, 6, 0.00, 0.00, 0.00),         -- Chaff (not used)
(16, 7, 3.00, 0.29, 450.00),       -- Methionine
(16, 8, 2.70, 0.26, 270.00),       -- Lysine
(16, 9, 12.00, 1.18, 540.00),      -- Mono Calcium
(16, 10, 12.00, 1.18, 7.20),       -- Limestone
(16, 11, 3.00, 0.29, 282.00),      -- Premix
(16, 12, 2.50, 0.25, 4.50),        -- Salt
(16, 13, 1.30, 0.13, 33.80),       -- Sodium Bicarbonate
(16, 14, 1.00, 0.10, 20.00),       -- Adsorbent
(16, 15, 0.25, 0.02, 50.00),       -- Mycotoxin Binder
(16, 16, 1.00, 0.10, 95.00),       -- Threonine
(16, 17, 0.20, 0.02, 58.00),       -- Fat Emulsion
(16, 18, 0.50, 0.05, 40.00),       -- Mediora Mycin
(16, 19, 0.35, 0.03, 92.75),       -- Tri-Boot 3
(16, 20, 0.125, 0.01, 50.00),      -- Phytase
(16, 21, 0.70, 0.07, 52.50),       -- Betaine
(16, 22, 0.00, 0.00, 0.00),        -- Sepenza (not used)
(16, 23, 0.30, 0.03, 60.00),       -- Energy Enzyme
(16, 24, 0.00, 0.00, 0.00),        -- Biody (not used)
(16, 25, 20.00, 1.96, 260.00);     -- Bags

SELECT 'All 16 recipes with ingredients inserted successfully' as status;
SELECT 'Total recipe items inserted: ' || COUNT(*) FROM feed_recipe_items;
