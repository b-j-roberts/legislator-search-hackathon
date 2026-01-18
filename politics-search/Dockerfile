# Stage 1: Chef base
FROM rust:1.92-bookworm AS chef
RUN cargo install cargo-chef --locked
WORKDIR /app

# Stage 2: Planner - generate recipe.json
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# Stage 3: Builder - build deps first (cached), then app
FROM chef AS builder

# Build dependencies for OpenSSL, Arrow, etc
RUN apt-get update && apt-get install -y \
    pkg-config libssl-dev cmake protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Cook dependencies (this layer is cached if recipe.json unchanged)
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json -p polsearch-api

# Build application
COPY . .
RUN cargo build --release -p polsearch-api

# Stage 4: Runtime (minimal)
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates libssl3 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 polsearch
USER polsearch
WORKDIR /home/polsearch

COPY --from=builder /app/target/release/polsearch-api /usr/local/bin/

ENV FASTEMBED_CACHE_PATH=/home/polsearch/.fastembed_cache
EXPOSE 3000
CMD ["polsearch-api"]
