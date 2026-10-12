package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
)

const (
	purposeTrack   = "track"
	purposeSession = "session"
)

func sign(key []byte, purpose, id string) string {
	m := hmac.New(sha256.New, key)
	m.Write([]byte(purpose + ":" + id))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

func verify(key []byte, purpose, id, sig string) bool {

	return hmac.Equal([]byte(sign(key, purpose, id)), []byte(sig))
}
