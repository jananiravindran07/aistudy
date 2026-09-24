# Build stage
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies (lockfile-only for reproducibility)
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source
COPY . .

# Prisma 7 note: the generated client lives in /generated/prisma (gitignored),
# so it must be regenerated as part of the build.
RUN npx prisma generate && npm run build

# Runtime stage
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma7.config.ts ./prisma7.config.ts

EXPOSE 3000
CMD ["npm", "run", "start"]