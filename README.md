# Timetable Generator

A web-based Timetable Generator application with Google Sheets integration.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Google Cloud project with Service Account and Sheets API enabled
- A Google Sheet shared with the service account email (Editor)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd "TimeTable Generator"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the project root:
   ```env
   PORT=3000
   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
   GOOGLE_SHEETS_SPREADSHEET_ID=YOUR_SPREADSHEET_ID
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
   ```

4. **Place service-account.json in project root**
   - Download from Google Cloud Console
   - Place the file in the project root (DO NOT commit this file)

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:3000`

## 📦 Deployment

### GitHub Setup

1. **Initialize Git (if not already done)**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Create a new repository on GitHub**
   - Go to GitHub and create a new repository
   - Don't initialize it with a README (since we already have one)

3. **Connect and push to GitHub**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

### Netlify Deployment

#### Option 1: Automatic Deployment via GitHub (Recommended)

1. **Get Netlify Auth Token**
   - Go to [Netlify](https://app.netlify.com/)
   - User settings → Applications → New access token
   - Copy the token

2. **Get Netlify Site ID**
   - Create a new site on Netlify
   - Connect it to your GitHub repository
   - Go to Site settings → General → Site details
   - Copy the Site ID

3. **Add GitHub Secrets**
   - Go to your GitHub repository
   - Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `NETLIFY_AUTH_TOKEN`: Your Netlify auth token
     - `NETLIFY_SITE_ID`: Your Netlify site ID

4. **Configure Netlify Site Settings**
   - Go to your Netlify site → Site settings → Build & deploy
   - Build settings:
     - Base directory: (leave empty or set to root)
     - Publish directory: `public`
     - Build command: (leave empty for static site)
   
5. **Automatic Deployments**
   - Every push to `main` branch will automatically deploy to Netlify
   - Check the Actions tab in GitHub to see deployment status

#### Option 2: Manual Netlify Deployment

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**
   ```bash
   netlify login
   ```

3. **Deploy**
   ```bash
   netlify deploy --dir=public --prod
   ```

### Environment Variables on Netlify

Since `.env` and `service-account.json` are not committed, you need to add them to Netlify:

1. Go to your Netlify site → Site settings → Environment variables
2. Add the following variables:
   - `GOOGLE_SHEETS_SPREADSHEET_ID`: Your Google Sheet ID
   - `GOOGLE_SERVICE_ACCOUNT_JSON_B64`: Base64 encoded service-account.json
     - To encode: `cat service-account.json | base64` (Linux/Mac) or use an online tool
   - `ALLOWED_ORIGINS`: Your Netlify site URL (e.g., `https://your-site.netlify.app`)

**Note:** For backend API (if deployed separately), use Netlify Functions or deploy backend separately.

## 🔒 Security Notes

- **Never commit** `service-account.json` or `.env` files
- These files are in `.gitignore`
- Always use environment variables for sensitive data in production

## 📁 Project Structure

```
.
├── public/          # Frontend files (HTML, CSS, JS)
├── src/            # Backend source code (TypeScript)
├── .github/        # GitHub Actions workflows
├── netlify.toml    # Netlify configuration
├── _redirects      # Netlify redirects for SPA routing
├── .gitignore      # Git ignore rules
└── README.md       # This file
```

## 🔧 API Endpoints

- `GET /health` → `{ ok: true }`
- `GET /timetable?sheet=Timetable` → Reads `A1:Z50`
- `POST /timetable/generate` → Generate timetable
- `POST /auth/signup` → Create account
- `POST /auth/login` → Login
- `POST /auth/reset` → Reset password

## 📝 Notes

- On some systems, PowerShell blocks npm scripts; use CMD or adjust execution policy
- Ensure your Google Sheet is shared with the service account email
- System time must be synced for JWT authentication to work

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Commit and push
5. Create a Pull Request

## 📄 License

[Your License Here]

