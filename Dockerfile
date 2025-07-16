# Base image
FROM golang:1.20 as builder

# Set the working directory
WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy application source files
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o duckdoc

# Start a new stage for the runtime image
FROM debian:bullseye-slim

# Set up working directory
WORKDIR /app

# Copy the built binary from the builder stage
COPY --from=builder /app/duckdoc .

# Expose the application port
EXPOSE 8080

# Command to run the application
CMD ["./duckdoc"]

