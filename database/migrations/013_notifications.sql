-- Migration 009: Create notification system tables
-- Creates tables for push notification subscriptions and notification logs

-- Notification Subscriptions table
CREATE TABLE IF NOT EXISTS notification_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    keys_p256h TEXT NOT NULL,
    keys_auth TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_used TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Notification Logs table
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('motion', 'face', 'object', 'system')),
    payload JSONB,
    sent_at TIMESTAMP DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('success', 'failed', 'pending')),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_user_id ON notification_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_is_active ON notification_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_event_id ON notification_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(sent_at DESC);

-- Add comments
COMMENT ON TABLE notification_subscriptions IS 'Stores push notification subscriptions for Web Push API';
COMMENT ON TABLE notification_logs IS 'Stores log of all notification attempts for audit trail';
COMMENT ON COLUMN notification_subscriptions.endpoint IS 'The push service endpoint URL';
COMMENT ON COLUMN notification_subscriptions.keys_p256h IS 'VAPID public key';
COMMENT ON COLUMN notification_subscriptions.keys_auth IS 'VAPID auth secret';
