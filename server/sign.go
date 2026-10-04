package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
)

// Two purposes so the signature that appears inside the email ("track")
// can't be reused by a recipient to call the write endpoints ("write").
const (
	purposeTrack = "track"
	purposeWrite = "write"
)

func sign(key []byte, purpose, id string) string {
	m := hmac.New(sha256.New, key)
	m.Write([]byte(purpose + ":" + id))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

func verify(key []byte, purpose, id, sig string) bool {
	// hmac.Equal compares in constant time, so response timing doesn't leak how much of a guess was right.
	return hmac.Equal([]byte(sign(key, purpose, id)), []byte(sig))
}
