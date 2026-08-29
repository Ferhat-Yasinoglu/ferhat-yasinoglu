FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# The rules travel with the image: they are the bot's answers, not its data.
# Edit rules.json, rebuild, redeploy — there is nothing to migrate.
COPY rules.json* ./
COPY rules.example.json ./

USER node
EXPOSE 3000
ENV HOST=0.0.0.0
ENV PORT=3000

# Credentials come from the environment, never from the image. Nothing here is
# secret, so this file is safe to publish alongside the source.
CMD ["node", "dist/src/index.js"]
