CREATE TABLE IF NOT EXISTS rate_limits (
    limiter_key TEXT PRIMARY KEY,
    request_count INTEGER NOT NULL CHECK (request_count >= 0),
    reset_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);
