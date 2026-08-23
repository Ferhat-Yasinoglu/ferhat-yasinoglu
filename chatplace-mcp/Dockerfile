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

USER node
EXPOSE 3000
# Auth is off unless CHATPLACE_API_KEYS is set — set it before exposing this.
CMD ["node", "dist/src/index.js", "--http"]
