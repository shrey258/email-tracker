package main

import (
	"log"
	"net/http"
)

func (s *server) stats(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", s.origin)
	w.Header().Set("Access-Control-Allow-Headers", "Authorization")
	w.Header().Set("Access-Control-Expose-Headers", "X-Session")
	w.Header().Set("Vary", "Origin")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	email, ok := s.signedIn(w, r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	body, err := allStats(r.Context(), s.db, email)
	if err != nil {
		log.Println("stats:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Write(body)
}
