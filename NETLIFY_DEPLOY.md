# Quick Netlify Deployment Guide

## Method 1: Drag & Drop (Easiest - No Login Needed)

1. Go to https://app.netlify.com/drop
2. Drag your entire `public` folder to the drop zone
3. Your site will deploy instantly!
4. Get your live URL (e.g., `https://random-123.netlify.app`)

## Method 2: Via GitHub (Automatic)

1. Push your code to GitHub (if not already done)
2. Go to https://app.netlify.com
3. Click "Add new site" → "Import an existing project"
4. Choose "GitHub" → Select your repository
5. Configure:
   - **Publish directory:** `public`
   - **Build command:** (leave empty)
6. Click "Deploy site"
7. Every push to GitHub will auto-deploy!

## Method 3: Netlify CLI (If logged in)

```bash
# Login (opens browser)
netlify login

# Deploy
netlify deploy --dir=public --prod --site=YOUR_SITE_ID
```

## After Deployment

1. Your site will be live at `https://your-site-name.netlify.app`
2. Add environment variables in Netlify:
   - Go to Site Settings → Environment variables
   - Add: `GOOGLE_SHEETS_SPREADSHEET_ID`, `ALLOWED_ORIGINS`, etc.

## Note

Your frontend is static HTML/CSS/JS, so it will work on Netlify!
The backend API endpoints will need to be hosted separately or use Netlify Functions.

