# Ready2eat Frozen Food Website

A deployable Node.js + Express + SQLite e-commerce starter for Ready2eat.

## Included
- Customer storefront using the supplied Ready2eat logo.
- Product catalog with packet sizes in grams and per-size pricing.
- Quantity selection and cart.
- Checkout with Bangladesh-style full delivery address fields.
- Cash on Delivery, bKash and Nagad payment selection.
- Manual online-payment transaction ID collection.
- Order confirmation + WhatsApp contact.
- Private admin panel at `/admin.html`.
- Admin can view/update order statuses, delete orders, add/edit/delete products and change store/payment/delivery settings.
- SQLite database automatically created as `ready2eat.db`.

## Default admin
User ID: `adminmtf`
Password: `adminmtf03`

For production, set `ADMIN_USER`, `ADMIN_PASS`, and `SESSION_SECRET` as environment variables and use a strong password.

## Run locally
1. Install Node.js 18+.
2. Open a terminal in this folder.
3. Run:
   npm install
   npm start
4. Open:
   http://localhost:3000
5. Admin:
   http://localhost:3000/admin.html

## Deployment
This project can be deployed to a Node-compatible host such as Render, Railway, VPS, or another server. Because SQLite is a local file database, production hosting should use a persistent disk/volume or a hosted database if the platform does not persist local files.

## Payment note
The bKash/Nagad checkout in this version records the selected payment method and transaction ID for admin verification. Real automatic payment confirmation requires official merchant/API credentials and a server-side integration. Do not put merchant secrets in browser JavaScript.

## Important production hardening
- Change the default admin password.
- Set a long random SESSION_SECRET.
- Enable HTTPS.
- Add rate limiting, CSRF protection, stronger validation and audit logs.
- Use a persistent production database/backups.
- For automatic bKash/Nagad payment, connect the official merchant APIs.


The admin login page no longer pre-fills the password. The bundled default credentials are provided above only so the owner can log in on first setup.
