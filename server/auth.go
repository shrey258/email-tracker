package main

import (
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

var tokeninfo = &http.Client{Timeout: 5 * time.Second}

const sessionTTL = 30 * 24 * time.Hour

func (s *server) signedIn(w http.ResponseWriter, r *http.Request) (string, bool) {
	token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok || token == "" {
		return "", false
	}
	email, ok := s.validSession(token)
	if !ok {
		if email, ok = s.ownerEmail(token); !ok {
			return "", false
		}
	}
	w.Header().Set("X-Session", s.newSession(email))
	return email, true
}

func (s *server) newSession(email string) string {
	expiry := strconv.FormatInt(time.Now().Add(sessionTTL).Unix(), 10)
	signed := expiry + "." + email
	return signed + "." + sign(s.key, purposeSession, signed)
}

func (s *server) validSession(token string) (string, bool) {
	firstDot, lastDot := strings.Index(token, "."), strings.LastIndex(token, ".")
	if firstDot < 0 || lastDot <= firstDot+1 {
		return "", false
	}
	signed, signature := token[:lastDot], token[lastDot+1:]
	email := token[firstDot+1 : lastDot]
	expiry, err := strconv.ParseInt(token[:firstDot], 10, 64)
	if err != nil || time.Now().Unix() >= expiry {
		return "", false
	}
	return email, verify(s.key, purposeSession, signed, signature) && s.isOwner(email)
}

func (s *server) ownerEmail(token string) (string, bool) {
	resp, err := tokeninfo.Get("https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(token))
	if err != nil {
		log.Println("tokeninfo:", err)
		return "", false
	}
	defer resp.Body.Close()
	var t struct {
		Aud           string `json:"aud"`
		Email         string `json:"email"`
		EmailVerified string `json:"email_verified"`
	}
	if resp.StatusCode != http.StatusOK || json.NewDecoder(resp.Body).Decode(&t) != nil {
		return "", false
	}
	if t.Aud != s.clientID || t.EmailVerified != "true" {
		return "", false
	}
	return strings.ToLower(t.Email), s.isOwner(t.Email)
}

func (s *server) isOwner(email string) bool {
	for _, o := range s.owners {
		if strings.EqualFold(strings.TrimSpace(o), email) {
			return true
		}
	}
	return false
}
