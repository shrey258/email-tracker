FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /server .

# Only the binary and CA certs (needed for TLS to CockroachDB Cloud) ship.
FROM alpine:3
RUN apk add --no-cache ca-certificates
COPY --from=build /server /server
CMD ["/server"]
