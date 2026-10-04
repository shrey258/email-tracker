package main

import (
	"context"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed schema.sql
var schema string

// Smallest valid transparent 1x1 GIF.
var pixel, _ = base64.StdEncoding.DecodeString("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")

type server struct {
	db  *pgxpool.Pool
	key []byte
}

func main() {
	dbURL, key := os.Getenv("DATABASE_URL"), os.Getenv("HMAC_KEY")
	if dbURL == "" || key == "" {
		log.Fatal("DATABASE_URL and HMAC_KEY must be set")
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	ctx := context.Background()
	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatal(err)
	}
	// ponytail: schema applied on every boot with IF NOT EXISTS; add a migration tool once tables need altering.
	if _, err := db.Exec(ctx, schema); err != nil {
		log.Fatal("applying schema: ", err)
	}

	s := &server{db: db, key: []byte(key)}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /mails", s.register)
	mux.HandleFunc("PATCH /mails/{id}", s.setGmailID)
	mux.HandleFunc("GET /o/{id}/{sig}", s.open)
	mux.HandleFunc("GET /c/{id}/{sig}/{n}", s.click)

	log.Println("listening on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

type registerReq struct {
	ID         string   `json:"id"`
	Sig        string   `json:"sig"` // write signature
	Subject    string   `json:"subject"`
	Recipients []string `json:"recipients"`
	Links      []string `json:"links"` // link n is Links[n-1]
}

// register stores an email and its links before the email is sent.
func (s *server) register(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if req.ID == "" || len(req.ID) > 64 || !verify(s.key, purposeWrite, req.ID, req.Sig) {
		http.Error(w, "bad id or signature", http.StatusUnauthorized)
		return
	}
	for _, l := range req.Links {
		// Only http(s), so a stored link can't become a javascript: or file: redirect.
		if u, err := url.Parse(l); err != nil || (u.Scheme != "http" && u.Scheme != "https") {
			http.Error(w, "bad link: "+l, http.StatusBadRequest)
			return
		}
	}

	// One transaction: either the email and all its links are saved, or nothing is.
	err := pgx.BeginFunc(r.Context(), s.db, func(tx pgx.Tx) error {
		if err := insertMail(r.Context(), tx, req.ID, req.Subject, req.Recipients); err != nil {
			return err
		}
		for i, l := range req.Links {
			if err := insertLink(r.Context(), tx, req.ID, i+1, l); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		log.Println("register:", err)
		http.Error(w, "could not save (duplicate id?)", http.StatusConflict)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

// setGmailID links our tracking ID to Gmail's message ID once the email is sent.
func (s *server) setGmailID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Sig     string `json:"sig"`
		GmailID string `json:"gmail_id"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&req); err != nil || req.GmailID == "" {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if !verify(s.key, purposeWrite, id, req.Sig) {
		http.Error(w, "bad signature", http.StatusUnauthorized)
		return
	}
	found, err := updateGmailID(r.Context(), s.db, id, req.GmailID)
	if err != nil {
		log.Println("set gmail id:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	if !found {
		http.NotFound(w, r)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// open logs an open and always returns the pixel, so a broken image never shows in the email.
func (s *server) open(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if verify(s.key, purposeTrack, id, r.PathValue("sig")) {
		// Fails only if the id was never registered; nothing useful to tell the caller.
		if err := insertOpen(r.Context(), s.db, id); err != nil {
			log.Println("open:", err)
		}
	}
	w.Header().Set("Content-Type", "image/gif")
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
	w.Write(pixel)
}

// click logs a click and redirects to the URL stored at registration, never to one taken from the request.
func (s *server) click(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	n, err := strconv.Atoi(r.PathValue("n"))
	if err != nil || !verify(s.key, purposeTrack, id, r.PathValue("sig")) {
		http.NotFound(w, r)
		return
	}
	target, err := linkURL(r.Context(), s.db, id, n)
	if errors.Is(err, pgx.ErrNoRows) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		log.Println("click lookup:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	// Redirect even if logging fails: the recipient reaching the link matters more than our stat.
	if err := insertClick(r.Context(), s.db, id, n); err != nil {
		log.Println("click log:", err)
	}
	http.Redirect(w, r, target, http.StatusFound)
}
