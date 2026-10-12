package main

// Sign-in: Google proves who you are once; after that the server's own signed session does.

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

// signedIn returns which owner account the request is from. It accepts a Google ID token from an
// owner account or a session we issued earlier, and answers with a fresh 30-day session in
// X-Session, so you only sign in again after 30 days unused. Google's tokens last an hour.
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
	exp := strconv.FormatInt(time.Now().Add(sessionTTL).Unix(), 10)
	w.Header().Set("X-Session", exp+"."+email+"."+sign(s.key, purposeSession, exp+"."+email))
	return email, true
}

// A session is "<expiry unix>.<email>.<signature over expiry.email>".
func (s *server) validSession(token string) (string, bool) {
	i, j := strings.Index(token, "."), strings.LastIndex(token, ".")
	if i < 0 || j <= i+1 {
		return "", false
	}
	n, err := strconv.ParseInt(token[:i], 10, 64)
	email := token[i+1 : j]
	return email, err == nil && time.Now().Unix() < n && verify(s.key, purposeSession, token[:j], token[j+1:]) && s.isOwner(email)
}

// isOwner asks Google to check the ID token's signature and expiry, then checks it was issued
// for our dashboard (aud) to one of the owners' verified addresses, and returns that address.
// ponytail: one call to Google per sign-in; verify locally against Google's keys if this gets slow.
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

// isOwner reports whether the address is in OWNER_EMAIL, so removing an account there also ends its sessions.
func (s *server) isOwner(email string) bool {
	for _, o := range s.owners {
		if strings.EqualFold(strings.TrimSpace(o), email) {
			return true
		}
	}
	return false
}
