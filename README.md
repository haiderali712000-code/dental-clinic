# H.I.K.S Dental Studio — Website + Admin Panel

Premium, mobile-friendly dental clinic website for **H.I.K.S Dental Studio**, Mandi Bahauddin, redesigned to closely match the supplied reference image while preserving the existing appointment/admin architecture.

## Implemented in this revision

- Official H.I.K.S logo remains the supplied logo; it is not redesigned.
- Reference-style header, hero, trust bar, offer ribbon, service cards, doctor card, gallery, FAQ, contact and footer.
- Doctor profile section for **Dr. HAFFI UR RREHMAN MINHASS**, BDS (ISB), Dental Surgeon (PAK), with a professional-photo slot.
- Expanded service list including Dental Check-up, Scaling & Polishing, Filling, RCT, Whitening, Crowns & Bridges, Extraction, Pediatric Dentistry, Implants, Wisdom Tooth Care and Cosmetic Dentistry.
- Sterilization section highlighting **Takazono Sangyo (Japan) MC-R220 Automatic High-Pressure Steam Sterilizer**.
- Dental X-Ray facility highlighted.
- Opening offer: FREE DENTAL CHECK-UP + 20% OFF on selected dental treatments.
- Scaling & Polishing rate: Rs. 5,000.
- WhatsApp, Call Now and Book Appointment actions.
- Google Maps embed + directions button.
- FAQ section with the requested dental questions.
- Before & After gallery structure for Scaling, Whitening, RCT, Crowns, Implants and Cosmetic Dentistry.
- SEO metadata, canonical URL, Open Graph metadata, local business structured data, robots.txt and sitemap.xml.
- Social media URLs are environment-configurable. No unverified social profile URL is fabricated.
- Appointment submission now validates the selected service and rejects invalid/past dates server-side.
- `/health` endpoint added for deployment smoke checks.

## Important asset note

The supplied reference screenshot contains the doctor/clinic visuals used to reproduce the requested visual direction. The current gallery/hero crops are therefore **reference-derived assets**, not independently verified original camera files. For production, replace them with the clinic's original full-resolution photographs if available.

## Social media

Set the real official profile URLs in `.env`:

```env
FACEBOOK_URL=
INSTAGRAM_URL=
TIKTOK_URL=
YOUTUBE_URL=
```

No official profiles were found through a web search for the supplied clinic name/phone, so the site does not invent or guess these URLs.

## Google Business Profile

The site includes Google Maps search/embed integration using the supplied clinic address. A direct Google Business Profile link should be placed in an environment variable once the clinic's verified profile URL is available.

## Run

1. Install Node.js 18+ and MongoDB (local or Atlas).
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set `MONGODB_URI`, `ADMIN_PASSWORD`, `SESSION_SECRET`, and any verified social URLs.
4. Run `npm start`.
5. Open `http://localhost:3000`.
6. Admin: `http://localhost:3000/admin/login`.
7. Smoke check: `http://localhost:3000/health`.

## Appointment live test

The application code and route validation were syntax-checked in this build environment. A full end-to-end booking test requires a reachable MongoDB instance because appointments and daily tokens are persisted in MongoDB.


## Treatment Results Gallery
- Admin panel: **Treatment Results**
- Upload real treatment result photos and select Scaling, Whitening, RCT, Crowns, Implants, Cosmetic Dentistry, or Other.
- Photos are stored in Cloudinary. Add your Cloudinary credentials to `.env` before uploading.

## Vercel deployment

This project is configured for Vercel through `api/index.js` and `vercel.json`.

Add these Environment Variables in Vercel (Production, Preview, and Development as needed):

```env
MONGODB_URI=your_mongodb_atlas_connection_string
ADMIN_PASSWORD=your_admin_password
SESSION_SECRET=your_long_random_session_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

If your Cloudinary setup already uses `CLOUDINARY_URL`, you can use that instead of the three Cloudinary variables.

Do not use `mongodb://127.0.0.1:27017/...` on Vercel; Vercel cannot connect to a MongoDB server running on your own PC. Use MongoDB Atlas (or another publicly reachable MongoDB provider).
