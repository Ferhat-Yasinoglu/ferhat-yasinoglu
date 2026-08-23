FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY spec ./spec

# The database lives here; mount a volume on it so bots and flows survive a
# container replacement.
ENV BOTFLOW_DB=/data/botflow.db
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]

USER node
EXPOSE 3000
# Auth is off unless BOTFLOW_API_KEYS is set — set it before exposing this.
# --disable-warning silences node:sqlite's ExperimentalWarning, which cannot be
# suppressed from inside the process (see the README).
CMD ["node", "--disable-warning=ExperimentalWarning", "dist/src/index.js", "--http"]
