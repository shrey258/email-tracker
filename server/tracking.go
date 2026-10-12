package main

import (
	"encoding/base64"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
)

func isOwnCopy(r *http.Request) bool {
	return r.URL.Query().Has("me")
}

func isGmailScan(r *http.Request) bool {
	return strings.Contains(r.UserAgent(), "Edge/12.246")
}

var pixel, _ = base64.StdEncoding.DecodeString("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")

func (s *server) open(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	switch {
	case isGmailScan(r):
		log.Println("open: skipped Gmail's delivery scan")
	case isOwnCopy(r):
		log.Println("open: skipped, your own copy")
	case verify(s.key, purposeTrack, id, r.PathValue("sig")):
		if err := insertOpen(r.Context(), s.db, id); err != nil {
			log.Println("open:", err)
		}
	}
	w.Header().Set("Content-Type", "image/gif")
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
	w.Write(pixel)
}

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
	if isOwnCopy(r) {
		log.Println("click: skipped, your own copy")
	} else if err := insertClick(r.Context(), s.db, id, n); err != nil {
		log.Println("click log:", err)
	}
	http.Redirect(w, r, target, http.StatusFound)
}
