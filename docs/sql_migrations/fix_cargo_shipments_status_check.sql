-- Fix: cargo_shipments.status CHECK constraint rejects every value, including
-- the column's own default ('created'). Confirmed by testing every value used
-- across the iOS/web/backend code (created, label_printed, picked_up,
-- in_transit, out_for_delivery, delivered, failed_delivery, returned,
-- cancelled, pending, confirmed) plus the column default itself — all were
-- rejected with "violates check constraint cargo_shipments_status_check".
-- Net effect: no row has ever been successfully inserted into cargo_shipments.
--
-- Run this in the Supabase SQL Editor (this cannot be done via the REST API
-- with a service role key - it requires DDL access).

-- 1. Inspect the current (broken) definition first if you want to see why it's wrong:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'cargo_shipments'::regclass
--   AND conname = 'cargo_shipments_status_check';

-- 2. Replace it with a constraint that actually matches the values the app writes:
ALTER TABLE cargo_shipments DROP CONSTRAINT IF EXISTS cargo_shipments_status_check;

ALTER TABLE cargo_shipments ADD CONSTRAINT cargo_shipments_status_check
  CHECK (status IN (
    'created',
    'label_printed',
    'picked_up',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'failed_delivery',
    'returned',
    'cancelled',
    'pending',
    'confirmed'
  ));

-- Note: cargo_status has its own separate check (if any) - its documented
-- values are: pending, picked_up, in_transit, delivered, confirmed.
-- If cargo_status also has a broken constraint, apply the same pattern:
-- ALTER TABLE cargo_shipments DROP CONSTRAINT IF EXISTS cargo_shipments_cargo_status_check;
-- ALTER TABLE cargo_shipments ADD CONSTRAINT cargo_shipments_cargo_status_check
--   CHECK (cargo_status IN ('pending', 'picked_up', 'in_transit', 'delivered', 'confirmed'));
