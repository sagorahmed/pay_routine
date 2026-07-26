# Vercel Deployment Guide

## Steps

1. Import `web/` project in Vercel.
2. Set all env vars from `web/.env.example`.
3. Configure build command: `npm run build`.
4. Configure output: default Next.js.
5. Deploy to production.

## Notes

- Never put private keys in Vercel env.
- API routes are metadata/analytics/notification only.
- Use Neon or Supabase Postgres for `DATABASE_URL`.
