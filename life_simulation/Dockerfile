# Build stage - Rust 1.83 required for edition2024 dependencies
FROM rust:1.83-slim as builder

# Cache buster - change this value to force full rebuild
ARG CACHE_BUST=2024121701

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests first for better caching
COPY life_core/Cargo.toml life_core/Cargo.toml
COPY life_simulation/Cargo.toml life_simulation/Cargo.toml

# Create dummy source files for dependency caching
RUN mkdir -p life_core/src life_simulation/src && \
    echo "pub fn dummy() {}" > life_core/src/lib.rs && \
    echo "fn main() {}" > life_simulation/src/main.rs

# Build dependencies (this layer will be cached)
WORKDIR /app/life_simulation
RUN cargo build --release 2>/dev/null || true

# Copy actual source
WORKDIR /app
COPY life_core/src life_core/src
COPY life_simulation/src life_simulation/src

# Build release
WORKDIR /app/life_simulation
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy binary
COPY --from=builder /app/life_simulation/target/release/life_simulation /usr/local/bin/life_simulation

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run server
CMD ["life_simulation"]
