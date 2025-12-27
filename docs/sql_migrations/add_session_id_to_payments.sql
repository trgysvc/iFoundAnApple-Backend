-- Migration: Add session_id and provider_transaction_id columns to payments table
-- Purpose: Store Paynet session_id to enable automatic complete-3d processing in callback handler
-- Date: 2025-01-XX

-- Add session_id column to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS provider_transaction_id VARCHAR(255);

-- Create index on session_id for fast lookup in callback handler
CREATE INDEX IF NOT EXISTS idx_payments_session_id ON payments(session_id);

-- Create index on provider_transaction_id for webhook matching
CREATE INDEX IF NOT EXISTS idx_payments_provider_transaction_id ON payments(provider_transaction_id);

-- Add comment to columns
COMMENT ON COLUMN payments.session_id IS 'Paynet 3D Secure session ID, used to find payment_id in callback handler';
COMMENT ON COLUMN payments.provider_transaction_id IS 'Paynet transaction ID returned from tds_initial API call';

