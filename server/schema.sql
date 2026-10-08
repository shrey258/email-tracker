CREATE TABLE IF NOT EXISTS mails (
    id         TEXT PRIMARY KEY,
    subject    TEXT NOT NULL,
    recipients TEXT[] NOT NULL,
    sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    gmail_id   TEXT
);

CREATE TABLE IF NOT EXISTS links (
    mail_id TEXT NOT NULL REFERENCES mails (id),
    n       INT NOT NULL,
    url     TEXT NOT NULL,
    PRIMARY KEY (mail_id, n)
);

CREATE TABLE IF NOT EXISTS opens (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mail_id   TEXT NOT NULL REFERENCES mails (id),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS opens_mail_id ON opens (mail_id);

CREATE TABLE IF NOT EXISTS clicks (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mail_id    TEXT NOT NULL,
    n          INT NOT NULL,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (mail_id, n) REFERENCES links (mail_id, n)
);
CREATE INDEX IF NOT EXISTS clicks_mail_id ON clicks (mail_id);

-- Supabase exposes public tables through its REST API. RLS with no policies blocks
-- that API entirely; our server connects as the table owner, which RLS doesn't restrict.
ALTER TABLE mails ENABLE ROW LEVEL SECURITY;
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE opens ENABLE ROW LEVEL SECURITY;
ALTER TABLE clicks ENABLE ROW LEVEL SECURITY;
