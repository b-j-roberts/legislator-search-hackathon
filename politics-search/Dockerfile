# Stage 1: Chef base with Ubuntu 24.04 for newer glibc (ort-sys needs glibc 2.38+)
FROM ubuntu:24.04 AS chef

# Install Rust and build dependencies
RUN apt-get update && apt-get install -y \
    curl build-essential pkg-config libssl-dev cmake protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.92.0
ENV PATH="/root/.cargo/bin:${PATH}"

RUN cargo install cargo-chef --locked
WORKDIR /app

# Stage 2: Planner - generate recipe.json
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# Stage 3: Builder - build deps first (cached), then app
FROM chef AS builder

# Cook dependencies (this layer is cached if recipe.json unchanged)
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json -p polsearch-api

# Build application
COPY . .
RUN cargo build --release -p polsearch-api

# Stage 4: Runtime (minimal)
FROM ubuntu:24.04

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
