package main

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func insertMail(ctx context.Context, tx pgx.Tx, id, sender, subject string, recipients []string) error {
	_, err := tx.Exec(ctx, `INSERT INTO mails (id, sender, subject, recipients) VALUES ($1, $2, $3, $4)`, id, sender, subject, recipients)
	return err
}

func insertLink(ctx context.Context, tx pgx.Tx, mailID string, n int, url string) error {
	_, err := tx.Exec(ctx, `INSERT INTO links (mail_id, n, url) VALUES ($1, $2, $3)`, mailID, n, url)
	return err
}

func insertOpen(ctx context.Context, db *pgxpool.Pool, mailID string) error {
	_, err := db.Exec(ctx, `
INSERT INTO opens (mail_id) SELECT $1
WHERE NOT EXISTS (SELECT 1 FROM opens WHERE mail_id = $1 AND opened_at > now() - interval '1 minute')`, mailID)
	return err
}

func linkURL(ctx context.Context, db *pgxpool.Pool, mailID string, n int) (string, error) {
	var url string
	err := db.QueryRow(ctx, `SELECT url FROM links WHERE mail_id = $1 AND n = $2`, mailID, n).Scan(&url)
	return url, err
}

func insertClick(ctx context.Context, db *pgxpool.Pool, mailID string, n int) error {
	_, err := db.Exec(ctx, `INSERT INTO clicks (mail_id, n) VALUES ($1, $2)`, mailID, n)
	return err
}

func allStats(ctx context.Context, db *pgxpool.Pool, sender string) ([]byte, error) {
	var out []byte
	err := db.QueryRow(ctx, `
SELECT coalesce(json_agg(m ORDER BY m.sent_at DESC), '[]') FROM (
  SELECT id, subject, recipients, sent_at,
    (SELECT coalesce(json_agg(opened_at ORDER BY opened_at), '[]') FROM opens WHERE mail_id = mails.id) AS opens,
    (SELECT coalesce(json_agg(json_build_object('n', c.n, 'url', l.url, 'at', c.clicked_at) ORDER BY c.clicked_at), '[]')
       FROM clicks c JOIN links l USING (mail_id, n) WHERE c.mail_id = mails.id) AS clicks
  FROM mails WHERE sender = $1 ORDER BY sent_at DESC LIMIT 200
) m`, sender).Scan(&out)
	return out, err
}
