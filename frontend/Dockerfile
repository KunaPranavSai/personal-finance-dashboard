FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=base /app/public ./public
COPY --from=base /app/.next ./.next
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
USER appuser
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
