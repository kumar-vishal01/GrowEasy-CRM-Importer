# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app

# NEXT_PUBLIC_* variables are inlined into the client bundle at BUILD time,
# not read at container start — so this must be a build ARG, not just a
# runtime environment variable, or the deployed frontend will silently keep
# pointing at whatever URL was set (or unset) when the image was built.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

COPY package*.json ./
RUN npm ci

COPY . .
# Requires next.config.js to set `output: 'standalone'` (see note below)
# for the minimal production runtime copy used in the next stage.
RUN npm run build

# --- Production stage ---
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

USER node
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
