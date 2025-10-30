## Timetable Backend (Google Sheets)

Minimal Express + TypeScript backend using Google Sheets as the DB.

### Prerequisites
- Node.js 18+
- Google Cloud project with Service Account and Sheets API enabled
- A Google Sheet shared with the service account email (Editor)

### Env
Create a `.env` file in project root:

```
PORT=3000
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
GOOGLE_SHEETS_SPREADSHEET_ID=YOUR_SPREADSHEET_ID
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

Place `service-account.json` in the project root.

### Install & Run
On some systems PowerShell blocks npm scripts; use CMD or adjust execution policy.

```
npm install
npm run dev
```

Build & start:

```
npm run build
npm start
```

### API
- GET `/health` → `{ ok: true }`
- GET `/timetable?sheet=Timetable` → reads `A1:Z50`
- POST `/timetable/generate`
  - Body (all optional):
  ```json
  {
    "sheet": "Timetable",
    "days": ["Mon","Tue","Wed","Thu","Fri"],
    "slotsPerDay": 6,
    "courses": ["Math","Physics","Chemistry"]
  }
  ```

