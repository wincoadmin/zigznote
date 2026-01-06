# ============================================
# Stage 1: Build
# ============================================
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace config and all package.json files
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY package.json turbo.json ./
COPY tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/

# Copy Prisma schema BEFORE install so postinstall can find it
COPY packages/database/prisma ./packages/database/prisma

# Install ALL dependencies (postinstall will generate Prisma client)
RUN pnpm install --frozen-lockfile

# Copy remaining source code
COPY apps/api ./apps/api
COPY packages ./packages

# Generate Prisma client (use explicit path since pnpm hoists to root)
ENV CI=true
RUN ./node_modules/.bin/prisma generate --schema=packages/database/prisma/schema.prisma

# Build packages using turbo (handles workspace deps correctly)
RUN ./node_modules/.bin/turbo run build --filter=@zigznote/api

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine AS runner

# Install required system tools
RUN apk add --no-cache postgresql-client wget

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 api

# Install pnpm for production install
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy package files for production install
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/

# Copy Prisma schema before install
COPY packages/database/prisma ./packages/database/prisma

# Install production dependencies only (ignore scripts to skip husky)
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built files from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy the generated Prisma client from builder
COPY --from=builder /app/node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Set ownership
RUN chown -R api:nodejs /app

# Switch to non-root user
USER api

# Environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the server
CMD ["node", "apps/api/dist/index.js"]
