#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Running database seed..."
npx prisma db seed 2>&1 || echo "Seed warning (non-fatal): $?"

echo "Starting application..."
exec "$@"
