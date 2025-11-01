# Deployment Guide

This guide walks you through deploying the Timetable Generator to GitHub and Netlify with automatic updates.

## Step-by-Step Deployment

### Part 1: GitHub Setup

1. **Check Git Status**
   ```bash
   git status
   ```

2. **Add All Files (except ignored ones)**
   ```bash
   git add .
   ```

3. **Commit Changes**
   ```bash
   git commit -m "Add deployment configuration"
   ```

4. **Create GitHub Repository**
   - Go to [github.com](https://github.com)
   - Click "+" → "New repository"
   - Name: `TimeTable` (or your preferred name)
   - Description: "Timetable Generator Application"
   - Choose Public or Private
   - **Don't** initialize with README (we already have one)
   - Click "Create repository"

5. **Link and Push**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/TimeTable.git
   git branch -M main
   git push -u origin main
   ```

### Part 2: Netlify Setup

1. **Create Netlify Account**
   - Go to [netlify.com](https://www.netlify.com)
   - Sign up/Login (preferably with GitHub)

2. **Create New Site**
   - Click "Add new site" → "Import an existing project"
   - Choose "GitHub" and authorize Netlify
   - Select your `TimeTable` repository

3. **Configure Build Settings**
   - **Base directory:** (leave empty)
   - **Build command:** (leave empty - static site)
   - **Publish directory:** `public`
   - Click "Deploy site"

4. **Get Site ID and Auth Token**
   - **Site ID:** Site settings → General → Site details → Site ID
   - **Auth Token:** User settings → Applications → New access token

5. **Add GitHub Secrets**
   - Go to your GitHub repo → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Add `NETLIFY_AUTH_TOKEN` with your Netlify token
   - Add `NETLIFY_SITE_ID` with your Site ID

6. **Environment Variables on Netlify**
   - Go to Netlify site → Site settings → Environment variables
   - Add:
     - `GOOGLE_SHEETS_SPREADSHEET_ID`: Your spreadsheet ID
     - `ALLOWED_ORIGINS`: Your Netlify URL (e.g., `https://your-site.netlify.app`)
   
   **For Service Account (choose one method):**
   - **Option A:** Add `GOOGLE_SERVICE_ACCOUNT_JSON_B64` (base64 encoded JSON)
   - **Option B:** Use Netlify Functions and store securely

### Part 3: Automatic Deployments

Once set up, **every push to the `main` branch** will:
1. Trigger GitHub Actions workflow
2. Automatically deploy to Netlify
3. Your site will update live!

**Test it:**
```bash
# Make a small change
echo "<!-- Updated -->" >> public/index.html
git add .
git commit -m "Test auto-deployment"
git push
```

Check GitHub Actions tab → You should see deployment running!
Check Netlify dashboard → Your site should auto-update!

## Troubleshooting

### Deployment fails
- Check GitHub Actions logs
- Verify Netlify secrets are correct
- Ensure `public` folder exists with `index.html`

### Site shows 404
- Verify Netlify publish directory is set to `public`
- Check that `index.html` exists in `public` folder
- Review Netlify build logs

### Environment variables not working
- Ensure variables are set in Netlify (not just GitHub)
- Check variable names match exactly
- Redeploy after adding variables

## Manual Deployment (Backup Method)

If automatic deployment doesn't work:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --dir=public --prod
```

## Need Help?

- Check Netlify logs: Site dashboard → Deploys
- Check GitHub Actions: Repo → Actions tab
- Review `.github/workflows/deploy.yml` for workflow issues

