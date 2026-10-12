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

// Your own copy of a sent email (in Sent) has "?me" on its tracking URLs (see extension/own-copy.js),
// so you viewing it on any device, or clicking its links, isn't counted.
func isOwnCopy(r *http.Request) bool { return r.URL.Query().Has("me") }

// Smallest valid transparent 1x1 GIF.
var pixel, _ = base64.StdEncoding.DecodeString("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")

// open logs an open and always returns the pixel, so a broken image never shows in the email.
func (s *server) open(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	// Gmail scans new mail for safety ~14s after delivery, fetching images with this old Edge user agent.
	// Real views come through Google's image proxy ("GoogleImageProxy"), so skip only the scanner.
	if strings.Contains(r.UserAgent(), "Edge/12.246") {
		log.Println("open: skipped Gmail's delivery scan")
	} else if isOwnCopy(r) {
		log.Println("open: skipped, your own copy")
	} else if verify(s.key, purposeTrack, id, r.PathValue("sig")) {
		// Fails only if the id was never registered; nothing useful to tell the caller.
		// A view within a minute of the last one isn't counted, so reloading the image can't inflate opens.
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
	if isOwnCopy(r) {
		log.Println("click: skipped, your own copy")
	} else if err := insertClick(r.Context(), s.db, id, n); err != nil {
		log.Println("click log:", err)
	}
	http.Redirect(w, r, target, http.StatusFound)
}
