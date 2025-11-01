# Quick Setup Guide

## ✅ Files Created for Deployment

I've created the following files for GitHub and Netlify integration:

1. **`.gitignore`** - Excludes sensitive files (service-account.json, .env)
2. **`netlify.toml`** - Netlify configuration for deployment
3. **`.github/workflows/deploy.yml`** - GitHub Actions workflow for auto-deployment
4. **`_redirects`** and **`public/_redirects`** - SPA routing support
5. **`README.md`** - Complete project documentation
6. **`DEPLOYMENT.md`** - Step-by-step deployment guide

## 🚀 Next Steps

### 1. Commit and Push to GitHub

```bash
# Check status
git status

# Add all files (sensitive files are automatically ignored)
git add .

# Commit
git commit -m "Add GitHub and Netlify deployment configuration"

# If you haven't created a GitHub repo yet:
# 1. Go to github.com and create a new repository
# 2. Then run:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### 2. Set Up Netlify

1. **Go to [netlify.com](https://www.netlify.com)** and sign up/login
2. **Click "Add new site"** → **"Import an existing project"**
3. **Choose GitHub** and authorize Netlify
4. **Select your repository** (`TimeTable` or your repo name)
5. **Configure build settings:**
   - Base directory: (leave empty)
   - Build command: (leave empty)
   - Publish directory: `public`
6. **Click "Deploy site"**

### 3. Get Netlify Credentials

1. **Site ID:**
   - Site settings → General → Site details → Copy "Site ID"

2. **Auth Token:**
   - User settings → Applications → New access token → Create token

### 4. Add GitHub Secrets

1. Go to your **GitHub repository**
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret:**
   - Name: `NETLIFY_AUTH_TOKEN`
   - Value: (paste your Netlify auth token)
4. **New repository secret:**
   - Name: `NETLIFY_SITE_ID`
   - Value: (paste your Site ID)

### 5. Add Environment Variables on Netlify

1. Go to your **Netlify site** → **Site settings** → **Environment variables**
2. Add:
   - `GOOGLE_SHEETS_SPREADSHEET_ID`: Your Google Sheet ID
   - `ALLOWED_ORIGINS`: Your Netlify site URL (e.g., `https://your-site.netlify.app`)

**For Service Account:**
- Option A: Add `GOOGLE_SERVICE_ACCOUNT_JSON_B64` (base64 encoded service-account.json)
- Option B: Use Netlify Functions (advanced)

### 6. Test Auto-Deployment

```bash
# Make a small change
echo "<!-- Updated -->" >> public/index.html

# Commit and push
git add .
git commit -m "Test auto-deployment"
git push
```

**Check:**
- **GitHub Actions tab** → You should see workflow running
- **Netlify dashboard** → Site should auto-update in ~1-2 minutes

## 📋 Verification Checklist

- [ ] All files committed to GitHub
- [ ] GitHub repository created and connected
- [ ] Netlify site created and connected to GitHub repo
- [ ] GitHub Secrets added (NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID)
- [ ] Netlify environment variables configured
- [ ] Test deployment works (push to main branch)

## 🎉 Success!

Once set up, **every push to `main` branch** will automatically:
1. Trigger GitHub Actions
2. Deploy to Netlify
3. Update your live site!

No manual deployment needed! 🚀

## ❓ Troubleshooting

**Deployment not working?**
- Check GitHub Actions logs (Repo → Actions tab)
- Verify Netlify secrets are correct
- Ensure `public` folder exists with `index.html`

**Site shows 404?**
- Verify Netlify publish directory is `public`
- Check Netlify build logs

**More help?**
- See `DEPLOYMENT.md` for detailed instructions
- Check Netlify and GitHub documentation

