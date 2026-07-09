# Ayurita Packaged Drinking Water — Product Requirements Document

## Original Problem Statement
Design and develop a premium, modern, responsive, and production-ready full-stack B2B website for **Ayurita Packaged Drinking Water**, a manufacturer and wholesale supplier of packaged drinking water based in Bishanpur, Begusarai, Bihar. Tagline: "Pure Water. Trusted Quality."

## User Choices (locked)
- **MVP scope**: Full — including admin dashboard, analytics, invoices, coupons, order tracking
- **Authentication**: Admin-only login (no customer accounts, public users check out as guests)
- **Payments**: No online payments; quote/COD-based B2B flow
- **Emails**: Skipped for v1 — inquiries land in admin dashboard
- **AI features**: Skipped for v1

## Personas
1. **Public buyer / procurement head** — browses products, requests bulk quote, places guest order, tracks order
2. **Admin (business owner / manager)** — logs in to admin console, manages products/categories/coupons, processes orders, replies to bulk inquiries & contact messages, views analytics

## Core Requirements (static)
- Premium brand aesthetic (colors #0F4C81 / #38BDF8 / #10B981 · Poppins + Inter · 16px rounded / glassmorphism)
- Fully responsive (desktop / tablet / mobile)
- Guest checkout with GST invoicing
- Bulk order inquiry pipeline
- Admin dashboard with revenue analytics
- Order status timeline (placed → confirmed → processing → packed → dispatched → delivered)

## What's Been Implemented (2026-02-09)
### Backend (FastAPI + MongoDB)
- JWT admin auth with bcrypt + startup admin seeding (env-based credentials)
- Products, Categories, Coupons full CRUD (admin) + public read
- Guest Orders with GST/discount/shipping computation and order-number tracking
- Bulk Inquiries + Contact Messages capture
- Analytics summary endpoint (revenue series, top products, order counts)
- Seed data: 6 categories, 10 products, 1 sample coupon (AYURITA10)

### Frontend (React + Tailwind + Framer Motion)
- **Public**: Home (hero, featured products, industries, 12-stage process, why-choose, testimonials, delivery map, FAQ, CTA), Products (filters), Product Detail (gallery, specs, MOQ, bulk pricing, related, WhatsApp order), Categories, Cart, Checkout (guest + coupon), Order Success, Order Tracking (by order number), About (mission/vision/values/timeline/owner message), Contact (form + map), Bulk Order
- **Admin**: Login, Dashboard (KPIs, 14-day revenue chart, top products, recent orders), Products CRUD (drawer w/ image list), Categories CRUD, Orders (list, filter, drawer detail, status update, CSV export), Bulk Inquiries (accept/reject/complete + admin note), Contact Messages, Coupons CRUD
- Floating WhatsApp CTA, sticky navbar, glassmorphism, premium footer

### Testing (all passed)
- 32/32 backend pytest tests
- Frontend flows: browse → cart → guest checkout w/ coupon → order-success → tracking; bulk inquiry; contact form; admin login + full sub-page navigation

## Prioritized Backlog (Next)
### P0 (near-term polish)
- SEO: sitemap.xml, robots.txt, per-page meta/OG tags
- GST invoice download (PDF) from admin order drawer
- Search: client-side product search improvement + recently viewed
- Progressive Web App manifest & service worker

### P1 (revenue / conversion)
- **Newsletter capture** on footer (lead nurturing for future email campaigns)
- **Wishlist & Compare Products** for public users
- **Product Catalogue PDF download** on Products page
- Voice search & AI product search (using Emergent LLM key)
- SMS + Email notifications (Resend / Twilio) — when keys are supplied
- Google Analytics integration

### P2 (scale)
- Multi-admin roles + admin activity log
- Customer account layer (opt-in) with order history + invoice downloads
- Online payments (Stripe / Razorpay) once user confirms
- Inventory low-stock alerts + auto-reorder threshold
- Bulk CSV import/export for products
- Split backend server.py into routers (auth/products/orders/admin/analytics)
- Tighten CORS to explicit origin list before production

## Credentials
See `/app/memory/test_credentials.md`.
