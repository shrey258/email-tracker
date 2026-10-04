CREATE TABLE IF NOT EXISTS mails (
    id         STRING PRIMARY KEY,
    subject    STRING NOT NULL,
    recipients STRING[] NOT NULL,
    sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    gmail_id   STRING
);

CREATE TABLE IF NOT EXISTS links (
    mail_id STRING NOT NULL REFERENCES mails (id),
    n       INT NOT NULL,
    url     STRING NOT NULL,
    PRIMARY KEY (mail_id, n)
);

CREATE TABLE IF NOT EXISTS opens (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mail_id   STRING NOT NULL REFERENCES mails (id),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    INDEX (mail_id)
);

CREATE TABLE IF NOT EXISTS clicks (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mail_id    STRING NOT NULL,
    n          INT NOT NULL,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (mail_id, n) REFERENCES links (mail_id, n),
    INDEX (mail_id)
);
