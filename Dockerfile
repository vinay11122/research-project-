FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=http://52.200.107.196:31606
ENV NEXT_PUBLIC_API_BASE_URL=http://52.200.107.196:31606
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=http://52.200.107.196:31606
ENV NEXT_PUBLIC_API_BASE_URL=http://52.200.107.196:31606

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/standalone ./

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
