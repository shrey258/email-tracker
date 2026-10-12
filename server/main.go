package main

import (
	"context"
	_ "embed"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed schema.sql
var schema string

type server struct {
	db               *pgxpool.Pool
	key              []byte
	clientID, origin string
	owners           []string
}

func main() {
	dbURL, key := os.Getenv("DATABASE_URL"), os.Getenv("HMAC_KEY")
	clientID, owner, origin := os.Getenv("GOOGLE_CLIENT_ID"), os.Getenv("OWNER_EMAIL"), os.Getenv("DASHBOARD_ORIGIN")
	if dbURL == "" || key == "" || clientID == "" || owner == "" || origin == "" {
		log.Fatal("DATABASE_URL, HMAC_KEY, GOOGLE_CLIENT_ID, OWNER_EMAIL (comma-separated for several accounts) and DASHBOARD_ORIGIN must be set")
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

	if _, err := db.Exec(ctx, schema); err != nil {
		log.Fatal("applying schema: ", err)
	}

	s := &server{db: db, key: []byte(key), clientID: clientID, origin: origin, owners: strings.Split(owner, ",")}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /mails", s.register)
	mux.HandleFunc("GET /o/{id}/{sig}", s.open)
	mux.HandleFunc("GET /c/{id}/{sig}/{n}", s.click)
	mux.HandleFunc("GET /stats", s.stats)
	mux.HandleFunc("OPTIONS /stats", s.stats)

	log.Println("listening on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, logRequests(mux)))
}

func logRequests(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s ip=%q ua=%q ref=%q", r.Method, r.URL.Path, r.Header.Get("Fly-Client-IP"), r.UserAgent(), r.Referer())
		h.ServeHTTP(w, r)
	})
}
