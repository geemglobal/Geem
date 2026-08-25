-- ============================================================
--  GPS Tracker Price Update — Pakistan Market Highest Prices
--  July 2025
--
--  SKIPPED (no change): all Yuntrack brand, G20, G20M
--
--  Run on VPS:
--    psql $DATABASE_URL -f scripts/update-gps-prices.sql
-- ============================================================

BEGIN;

-- ── Geem Orange 2.0 ─────────────────────────────────────────
UPDATE products SET price = '7000.00', sale_price = '5999.00'
WHERE slug = 'geem-orange-2-gps-tracker-4g-lte';

-- ── Geem Orange ─────────────────────────────────────────────
UPDATE products SET price = '6500.00', sale_price = '5499.00'
WHERE slug = 'geem-orange-gps-tracker-4g';

-- ── CarePro TD-02S (Kids GPS Watch) ─────────────────────────
UPDATE products SET price = '8500.00', sale_price = '6999.00'
WHERE slug = 'carepro-td02s-kids-gps-smartwatch';

-- ── Wanway S20 (4G Motorcycle) ──────────────────────────────
UPDATE products SET price = '7000.00', sale_price = '5999.00'
WHERE slug = 'wanway-s20-4g-motorcycle-gps-tracker';

-- ── Goome GM06NW (Motorcycle) ───────────────────────────────
UPDATE products SET price = '7500.00', sale_price = '6499.00'
WHERE slug = 'goome-gm06nw-motorcycle-gps-tracker';

-- ── Micodus GT06 (Mini Vehicle) ─────────────────────────────
UPDATE products SET price = '4500.00', sale_price = '3999.00'
WHERE slug = 'micodus-gt06-mini-gps-tracker';

-- ── Micodus GT06/TK200 (Dual-Mode) ──────────────────────────
UPDATE products SET price = '5000.00', sale_price = '4499.00'
WHERE slug = 'micodus-gt06-tk200-4g-gps-tracker';

-- ── Micodus GT02D (Compact Vehicle) ─────────────────────────
UPDATE products SET price = '4000.00', sale_price = '3499.00'
WHERE slug = 'micodus-gt02d-4g-gps-tracker';

-- ── Micodus GT02/T3 (Wired Vehicle) ─────────────────────────
UPDATE products SET price = '4000.00', sale_price = '3499.00'
WHERE slug = 'micodus-gt02-t3-4g-gps-tracker';

-- ── Micodus MV710G (Fuel Monitoring) ────────────────────────
UPDATE products SET price = '10000.00', sale_price = '8999.00'
WHERE slug = 'micodus-mv710g-4g-fuel-gps-tracker';

-- ── Wanway GS900 (4G Motorcycle) ────────────────────────────
UPDATE products SET price = '8000.00', sale_price = '6999.00'
WHERE slug = 'wanway-gs900-motorcycle-gps-tracker';

-- ── SinoTrack ST-900 (Vehicle) ──────────────────────────────
UPDATE products SET price = '5000.00', sale_price = '4299.00'
WHERE slug = 'sinotrack-st900-4g-gps-tracker';

-- ── SinoTrack ST815 (Long Battery) ──────────────────────────
UPDATE products SET price = '7000.00', sale_price = '5999.00'
WHERE slug = 'sinotrack-st815-4g-gps-tracker';

-- ── 365GPS GF21 (Mini Coin Personal) ────────────────────────
UPDATE products SET price = '5500.00', sale_price = '4999.00'
WHERE slug = '365gps-gf21-mini-gps-tracker';

-- ── 360GPS GF21 (Mini Personal) ─────────────────────────────
UPDATE products SET price = '5500.00', sale_price = '4999.00'
WHERE slug = '360gps-gf21-mini-gps-tracker';

-- ── IoT Universal GPS Tracker ────────────────────────────────
UPDATE products SET price = '5000.00', sale_price = '4299.00'
WHERE slug = 'iot-universal-4g-gps-tracker';

-- ── P31 Portable Personal ───────────────────────────────────
UPDATE products SET price = '5500.00', sale_price = '4799.00'
WHERE slug = 'p31-portable-personal-gps-tracker';

-- ── N9 GSM Multi-Purpose ────────────────────────────────────
UPDATE products SET price = '5500.00', sale_price = '4799.00'
WHERE slug = 'n9-gsm-4g-gps-tracker';

-- ── Any extra dynamically-generated slugs from catalog-overhaul
--    (products whose slug contains these model names, excl. Yuntrack/G20/G20M)
UPDATE products SET price = '4500.00', sale_price = '3999.00'
WHERE slug LIKE '%gt06%'
  AND slug NOT LIKE 'micodus-gt06-mini%'
  AND slug NOT LIKE 'micodus-gt06-tk200%';

UPDATE products SET price = '4000.00', sale_price = '3499.00'
WHERE slug LIKE '%gt02%'
  AND slug NOT LIKE 'micodus-gt02d%'
  AND slug NOT LIKE 'micodus-gt02-t3%';

UPDATE products SET price = '5500.00', sale_price = '4999.00'
WHERE slug LIKE '%gf21%'
  AND slug NOT LIKE '365gps-gf21%'
  AND slug NOT LIKE '360gps-gf21%';

UPDATE products SET price = '2500.00', sale_price = '2199.00'
WHERE slug LIKE '%gf07%';

UPDATE products SET price = '4500.00', sale_price = '3999.00'
WHERE slug LIKE '%-st903-%' OR slug LIKE '%st903-%';

UPDATE products SET price = '5000.00', sale_price = '4499.00'
WHERE slug LIKE '%-st904-%' OR slug LIKE '%st904-%';

UPDATE products SET price = '6000.00', sale_price = '5299.00'
WHERE slug LIKE '%-st915-%' OR slug LIKE '%st915-%';

UPDATE products SET price = '6500.00', sale_price = '5499.00'
WHERE slug LIKE '%tk905%';

UPDATE products SET price = '7500.00', sale_price = '6499.00'
WHERE slug LIKE '%tk915%';

UPDATE products SET price = '28000.00', sale_price = '24999.00'
WHERE slug LIKE '%garmin%' OR slug LIKE '%etrex%';

UPDATE products SET price = '7000.00', sale_price = '5999.00'
WHERE slug LIKE '%-lk930-%' OR slug LIKE '%lk930%';

COMMIT;

-- ── Verification — show updated prices ──────────────────────
SELECT slug, title, price, sale_price
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE c.name ILIKE '%gps%'
  AND slug NOT LIKE 'yuntrack-%'
  AND slug NOT LIKE '%micodus-g20-%'
  AND slug NOT LIKE '%micodus-g20m-%'
ORDER BY price::numeric DESC;
