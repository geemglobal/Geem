-- GPS tracker fixes:
-- 1. Remove all GSM/GSM GPRS mentions from non-Wanway GPS trackers
-- 2. Add car & bike keywords to Vehicle GPS Tracker products
-- Run: psql $DATABASE_URL -f scripts/fix-gps-remove-gsm-add-carbike.sql

BEGIN;

-- ── Step 1: Strip all GSM references from non-Wanway GPS tracker products ────

UPDATE products p
SET
  -- Title: remove " GSM " between words, " GSM" at end, "GSM " at start
  title = TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(title, 'GSM/GPRS\s*', '', 'gi'),
        '\s+GSM\s+', ' ', 'g'
      ),
      '\s+GSM$|^GSM\s+', '', 'g'
    )
  ),

  -- Short description: remove GSM/GPRS and standalone GSM
  short_description = TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(short_description, '2G\s+GSM/GPRS', '2G', 'gi'),
        'GSM/GPRS', '', 'gi'
      ),
      '\s+GSM\s+|\s+GSM$|^GSM\s+', ' ', 'g'
    )
  ),

  -- Long description: most specific first
  long_description = REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(long_description, '2G\s+GSM/GPRS', '2G', 'gi'),
        'GSM/GPRS', '', 'gi'
      ),
      '\s+GSM\s', ' ', 'g'
    ),
    '\sGSM$', '', 'gm'   -- end-of-line GSM (multiline)
  ),

  -- Meta title
  meta_title = TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(meta_title, 'GSM/GPRS\s*', '', 'gi'),
        '\s+GSM\s+', ' ', 'g'
      ),
      '\s+GSM$|^GSM\s+', '', 'g'
    )
  ),

  -- Meta description
  meta_description = TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(meta_description, 'GSM/GPRS', '', 'gi'),
        '\s+GSM\s+', ' ', 'g'
      ),
      '\s+GSM$', '', 'g'
    )
  ),

  -- Meta keywords: drop any keyword entry containing "gsm"
  meta_keywords = TRIM(BOTH ',' FROM
    REGEXP_REPLACE(
      REGEXP_REPLACE(meta_keywords, ',\s*[^,]*gsm[^,]*', '', 'gi'),
      '[^,]*gsm[^,]*,?\s*', '', 'gi'
    )
  )

FROM categories c
WHERE p.category_id = c.id
  AND c.name ILIKE '%gps%'
  AND p.slug NOT LIKE 'wanway%';


-- ── Step 2: Vehicle GPS Trackers — add Car & Bike to descriptions & keywords ──

UPDATE products p
SET
  short_description = COALESCE(short_description, '') ||
    ' Suitable for cars, bikes, motorcycles, and light commercial vehicles in Pakistan.',

  meta_keywords = COALESCE(meta_keywords, '') ||
    ',car gps tracker pakistan,bike gps tracker pakistan,vehicle tracker car bike,gps tracker for car,gps tracker for motorcycle,car tracker lahore,car tracker karachi,car tracker islamabad'

FROM categories c
WHERE p.category_id = c.id
  AND c.name = 'Vehicle GPS Trackers';

-- Motorcycle GPS Trackers — add bike-specific keywords
UPDATE products p
SET
  meta_keywords = COALESCE(meta_keywords, '') ||
    ',motorcycle gps tracker pakistan,bike tracker pakistan,motorbike tracker,anti theft gps bike,bike gps lahore karachi'

FROM categories c
WHERE p.category_id = c.id
  AND c.name = 'Motorcycle GPS Trackers'
  AND p.slug NOT LIKE 'wanway%';

COMMIT;

-- Verify titles look clean
SELECT slug, title FROM products p
JOIN categories c ON c.id = p.category_id
WHERE c.name ILIKE '%gps%' AND p.slug NOT LIKE 'wanway%'
ORDER BY p.slug;
