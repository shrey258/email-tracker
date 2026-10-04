package main

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Every SQL statement the server runs lives in this file.

func insertMail(ctx context.Context, tx pgx.Tx, id, subject string, recipients []string) error {
	_, err := tx.Exec(ctx, `INSERT INTO mails (id, subject, recipients) VALUES ($1, $2, $3)`, id, subject, recipients)
	return err
}

func insertLink(ctx context.Context, tx pgx.Tx, mailID string, n int, url string) error {
	_, err := tx.Exec(ctx, `INSERT INTO links (mail_id, n, url) VALUES ($1, $2, $3)`, mailID, n, url)
	return err
}

// updateGmailID reports whether a mail with that id existed.
func updateGmailID(ctx context.Context, db *pgxpool.Pool, id, gmailID string) (bool, error) {
	tag, err := db.Exec(ctx, `UPDATE mails SET gmail_id = $1 WHERE id = $2`, gmailID, id)
	return tag.RowsAffected() > 0, err
}

func insertOpen(ctx context.Context, db *pgxpool.Pool, mailID string) error {
	_, err := db.Exec(ctx, `INSERT INTO opens (mail_id) VALUES ($1)`, mailID)
	return err
}

// linkURL returns pgx.ErrNoRows if the email has no link n.
func linkURL(ctx context.Context, db *pgxpool.Pool, mailID string, n int) (string, error) {
	var url string
	err := db.QueryRow(ctx, `SELECT url FROM links WHERE mail_id = $1 AND n = $2`, mailID, n).Scan(&url)
	return url, err
}

func insertClick(ctx context.Context, db *pgxpool.Pool, mailID string, n int) error {
	_, err := db.Exec(ctx, `INSERT INTO clicks (mail_id, n) VALUES ($1, $2)`, mailID, n)
	return err
}
