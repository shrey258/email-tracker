FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /server .

FROM alpine:3
RUN apk add --no-cache ca-certificates
COPY --from=build /server /server
CMD ["/server"]
