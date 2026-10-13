package main

import (
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"regexp"

	"github.com/jackc/pgx/v5"
)

var validID = regexp.MustCompile(`^[A-Za-z0-9-]{1,64}$`)

type registerReq struct {
	ID         string   `json:"id"`
	Subject    string   `json:"subject"`
	Recipients []string `json:"recipients"`
	Links      []string `json:"links"`
}

func (s *server) register(w http.ResponseWriter, r *http.Request) {
	sender, ok := s.signedIn(w, r)
	if !ok {
		http.Error(w, "signed out", http.StatusUnauthorized)
		return
	}
	var req registerReq
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if !validID.MatchString(req.ID) {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	for _, l := range req.Links {
		if u, err := url.Parse(l); err != nil || (u.Scheme != "http" && u.Scheme != "https") {
			http.Error(w, "bad link: "+l, http.StatusBadRequest)
			return
		}
	}

	err := pgx.BeginFunc(r.Context(), s.db, func(tx pgx.Tx) error {
		if err := insertMail(r.Context(), tx, req.ID, sender, req.Subject, req.Recipients); err != nil {
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
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"track_sig": sign(s.key, purposeTrack, req.ID)})
}
