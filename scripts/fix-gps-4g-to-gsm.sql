-- Fix GPS trackers: replace 4G/4G LTE with GSM/GPRS for all non-Wanway products
-- Only Wanway GPS trackers are 4G; all others are 2G GSM/GPRS devices
-- Run: psql $DATABASE_URL -f scripts/fix-gps-4g-to-gsm.sql

BEGIN;

UPDATE products p
SET
  -- ── TITLE ──────────────────────────────────────────────────────────────────
  -- Remove standalone "4G LTE " and "4G LTE" then replace remaining "4G" → "GSM"
  title = regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(title, '4G LTE ', '', 'gi'),
        ' 4G LTE', '', 'gi'
      ),
      '4G LTE', 'GSM', 'gi'
    ),
    '4G', 'GSM', 'gi'
  ),

  -- ── SHORT DESCRIPTION ──────────────────────────────────────────────────────
  short_description = regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          short_description,
          '4G LTE \+ 2G (GPRS|GSM)( fallback)?', '2G GSM/GPRS', 'gi'
        ),
        '4G LTE', 'GSM/GPRS', 'gi'
      ),
      '4G ', 'GSM ', 'gi'
    ),
    ' 4G', ' GSM', 'gi'
  ),

  -- ── LONG DESCRIPTION ───────────────────────────────────────────────────────
  -- Most specific → least specific, to avoid double-substitution
  long_description = regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  long_description,
                  -- "4G LTE Cat-M1 + 2G GSM" → "2G GSM/GPRS"
                  '4G LTE Cat-M1 \+ 2G GSM', '2G GSM/GPRS', 'gi'
                ),
                -- "4G LTE + 2G GPRS fallback" → "2G GSM/GPRS"
                '4G LTE \+ 2G GPRS( fallback)?', '2G GSM/GPRS', 'gi'
              ),
              -- "4G LTE + 2G GSM" → "2G GSM/GPRS"
              '4G LTE \+ 2G GSM', '2G GSM/GPRS', 'gi'
            ),
            -- "4G LTE + 2G" (any remaining) → "2G GSM/GPRS"
            '4G LTE \+ 2G', '2G GSM/GPRS', 'gi'
          ),
          -- "4G LTE (B1/B3/B5/B8/B28)" band specs → "GSM/GPRS"
          '4G LTE \([^)]+\)', 'GSM/GPRS', 'gi'
        ),
        -- "4G LTE real-time tracking" → "GSM real-time tracking"
        '4G LTE real-time', 'GSM real-time', 'gi'
      ),
      -- All remaining "4G LTE" → "GSM/GPRS"
      '4G LTE', 'GSM/GPRS', 'gi'
    ),
    -- All remaining "4G" → "GSM"
    '4G', 'GSM', 'gi'
  ),

  -- ── META TITLE ─────────────────────────────────────────────────────────────
  meta_title = regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(meta_title, '4G LTE ', '', 'gi'),
        ' 4G LTE', '', 'gi'
      ),
      '4G LTE', 'GSM', 'gi'
    ),
    '4G', 'GSM', 'gi'
  ),

  -- ── META DESCRIPTION ───────────────────────────────────────────────────────
  meta_description = regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          meta_description,
          '4G LTE \+ 2G (GPRS|GSM)( fallback)?', '2G GSM/GPRS', 'gi'
        ),
        '4G LTE', 'GSM/GPRS', 'gi'
      ),
      '4G ', 'GSM ', 'gi'
    ),
    ' 4G', ' GSM', 'gi'
  ),

  -- ── META KEYWORDS ──────────────────────────────────────────────────────────
  -- Replace "4g" keyword tokens with "gsm" to maintain keyword density
  meta_keywords = regexp_replace(
    meta_keywords,
    '4g', 'gsm', 'gi'
  )

FROM categories c
WHERE p.category_id = c.id
  AND c.name ILIKE '%gps%'
  AND p.slug NOT LIKE 'wanway%';

COMMIT;

-- Verification: show updated titles for non-Wanway GPS products
SELECT p.slug, p.title
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE c.name ILIKE '%gps%'
  AND p.slug NOT LIKE 'wanway%'
ORDER BY p.slug;
