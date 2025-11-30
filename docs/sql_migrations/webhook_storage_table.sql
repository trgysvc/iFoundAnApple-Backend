-- Webhook Storage Table Migration
-- This table stores webhook payloads from payment providers (Paynet, etc.)
-- Provides idempotency, retry mechanism, and audit trail for webhooks
-- Created: 2025-01-15

CREATE TABLE IF NOT EXISTS webhook_storage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  reference_no VARCHAR(255) UNIQUE NOT NULL, -- Payment reference number from provider
  webhook_payload JSONB NOT NULL, -- Complete webhook payload
  is_succeed BOOLEAN NOT NULL, -- Payment success status from webhook
  received_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE, -- When webhook was successfully processed
  retry_count INT DEFAULT 0 NOT NULL, -- Number of retry attempts
  last_retry_at TIMESTAMP WITH TIME ZONE, -- Last retry attempt timestamp
  error_message TEXT, -- Error message if processing failed
  signature TEXT, -- Webhook signature for verification
  provider VARCHAR(50) DEFAULT 'paynet' NOT NULL, -- Payment provider (paynet, stripe, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_storage_payment_id ON webhook_storage(payment_id);
CREATE INDEX IF NOT EXISTS idx_webhook_storage_reference_no ON webhook_storage(reference_no);
CREATE INDEX IF NOT EXISTS idx_webhook_storage_processed_at ON webhook_storage(processed_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_storage_received_at ON webhook_storage(received_at);
CREATE INDEX IF NOT EXISTS idx_webhook_storage_retry_count ON webhook_storage(retry_count, last_retry_at) WHERE processed_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_webhook_storage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_webhook_storage_updated_at
  BEFORE UPDATE ON webhook_storage
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_storage_updated_at();

-- Comments
COMMENT ON TABLE webhook_storage IS 'Stores webhook payloads from payment providers for idempotency, retry, and audit purposes';
COMMENT ON COLUMN webhook_storage.reference_no IS 'Unique reference number from payment provider - used for idempotency';
COMMENT ON COLUMN webhook_storage.webhook_payload IS 'Complete webhook payload as received from provider';
COMMENT ON COLUMN webhook_storage.is_succeed IS 'Payment success status from webhook (is_succeed field)';
COMMENT ON COLUMN webhook_storage.processed_at IS 'Timestamp when webhook was successfully processed - NULL means not processed yet';
COMMENT ON COLUMN webhook_storage.retry_count IS 'Number of retry attempts for failed webhook processing';
COMMENT ON COLUMN webhook_storage.provider IS 'Payment provider name (paynet, stripe, etc.)';

