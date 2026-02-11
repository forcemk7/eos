# Testing eOS

## Quick Start

1. **Start the server:**
   ```bash
   npm start
   ```
   Or:
   ```bash
   node server.js
   ```

2. **Open your browser:**
   Go to `http://localhost:3000`

3. **What you'll see:**
   - **Setup Tab** (default) - Configure job search preferences
   - **Applications Tab** - Kanban board to track job applications
   - **Resume Lab Tab** - Upload and parse your resume
   - **Life Rates Tab** - Calculate hourly rates from constraints

## Testing Each Feature

### 1. Setup & Preferences
- Go to the **Setup** tab
- Fill in job titles (one per line)
- Add keywords (comma-separated)
- Set location preferences
- Set salary range
- Choose company sizes
- Set max applications per day
- Toggle automation on/off
- Add screening questions (JSON format)
- Click "Save Preferences"
- ✅ Should see success message

### 2. Resume Lab
- Go to **Resume Lab** tab
- Upload a PDF or DOCX resume
- ✅ Should see "Parsing resume..." message
- ✅ Should see parsed resume preview with structured data
- ✅ Resume should be saved to database

**Note:** Requires `OPENAI_API_KEY` environment variable for parsing to work.

### 3. Application Tracker
- Go to **Applications** tab
- ✅ Should see kanban board with 4 columns: Applied, Interview, Offer, Rejected
- Currently empty (no applications yet)
- Once you have applications, you can:
  - Drag cards between columns to update status
  - Click the menu (⋯) to view job details

### 4. Life Rates Calculator
- Go to **Life Rates** tab
- Adjust the inputs:
  - Max hours per day
  - Working days per week
  - Working weeks per year
  - Minimum income per month
  - Tax rate
- Click "Recalculate"
- ✅ Should see calculated hourly rates and income projections

## Testing API Endpoints

You can test the API directly using curl or a tool like Postman:

### Get Preferences
```bash
curl http://localhost:3000/api/preferences
```

### Save Preferences
```bash
curl -X POST http://localhost:3000/api/preferences \
  -H "Content-Type: application/json" \
  -d '{
    "jobTitles": ["Software Engineer"],
    "keywords": ["React", "Node.js"],
    "locationType": "remote",
    "maxApplicationsPerDay": 50,
    "automationEnabled": true
  }'
```

### Get Applications
```bash
curl http://localhost:3000/api/applications
```

### Get Resumes
```bash
curl http://localhost:3000/api/resumes
```

## Environment Variables

Create a `.env` file (optional for now):
```
OPENAI_API_KEY=your_key_here
PORT=3000
```

The server will work without OpenAI key, but resume parsing won't work.

## Database

The database is automatically created as `earnos.db` (SQLite) in the project root on first run.

## Troubleshooting

- **Server won't start?** Check if port 3000 is already in use
- **Resume parsing fails?** Make sure OPENAI_API_KEY is set
- **Database errors?** Check that the `earnos.db` file has write permissions
- **API returns errors?** Check the server console for error messages

## Next Steps (Not Yet Built)

- Job scraping engine (finds jobs automatically)
- Application automation (auto-fills forms)
- Background job queue (processes applications daily)
