package main

import "testing"

func TestVerify(t *testing.T) {
	key := []byte("test-key")
	sig := sign(key, purposeTrack, "abc123")

	if !verify(key, purposeTrack, "abc123", sig) {
		t.Fatal("valid signature rejected")
	}
	if verify(key, purposeTrack, "abc124", sig) {
		t.Fatal("signature accepted for a different id")
	}
	if verify([]byte("other-key"), purposeTrack, "abc123", sig) {
		t.Fatal("signature accepted under a different key")
	}
	if verify(key, purposeWrite, "abc123", sig) {
		t.Fatal("track signature accepted for write")
	}
}
