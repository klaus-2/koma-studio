# syntax=docker/dockerfile:1
FROM rust:1.86-slim-bookworm AS builder
WORKDIR /app

COPY apps/discord-support-bot/Cargo.toml ./Cargo.toml
RUN mkdir -p src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src

COPY apps/discord-support-bot/src ./src
RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=builder /app/target/release/koma-discord-support-bot /usr/local/bin/koma-discord-support-bot
ENV RUST_LOG=info,koma_discord_support_bot=debug
CMD ["koma-discord-support-bot"]
