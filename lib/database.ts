// sqlite3 is a native CommonJS module, so we use require
const sqlite3 = require('sqlite3').verbose()
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'earnos.db')

// Ensure database file exists
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, '')
}

const db = new sqlite3.Database(DB_PATH)

// Initialize database schema
export function initDatabase() {
  return new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(
        `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
        (err: Error | null) => {
          if (err) reject(err)
        }
      )

      // Resumes table
      db.run(
        `CREATE TABLE IF NOT EXISTS resumes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        raw_text TEXT,
        parsed_data TEXT,
        file_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
        (err: Error | null) => {
          if (err) reject(err)
        }
      )

      // User preferences table
      db.run(
        `CREATE TABLE IF NOT EXISTS user_preferences (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        job_titles TEXT,
        keywords TEXT,
        location_type TEXT,
        location_cities TEXT,
        location_countries TEXT,
        salary_min INTEGER,
        salary_max INTEGER,
        company_size TEXT,
        max_applications_per_day INTEGER DEFAULT 50,
        automation_enabled INTEGER DEFAULT 0,
        screening_questions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
        (err: Error | null) => {
          if (err) reject(err)
        }
      )

      // Job postings table
      db.run(
        `CREATE TABLE IF NOT EXISTS job_postings (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        url TEXT UNIQUE NOT NULL,
        location TEXT,
        salary TEXT,
        description TEXT,
        posted_date TEXT,
        scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        match_score REAL,
        status TEXT DEFAULT 'new'
      )`,
        (err: Error | null) => {
          if (err) reject(err)
        }
      )

      // Applications table
      db.run(
        `CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        job_posting_id TEXT NOT NULL,
        status TEXT DEFAULT 'applied',
        resume_version_id TEXT,
        cover_letter TEXT,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (job_posting_id) REFERENCES job_postings(id)
      )`,
        (err: Error | null) => {
          if (err) reject(err)
        }
      )

      // Application history (for learning)
      db.run(
        `CREATE TABLE IF NOT EXISTS application_history (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        action TEXT,
        old_value TEXT,
        new_value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES applications(id)
      )`,
        (err: Error | null) => {
          if (err) reject(err)
        }
      )

      // Add storage_path for Supabase Storage (migration for existing DBs)
      db.run('ALTER TABLE resumes ADD COLUMN storage_path TEXT', () => {})

      db.run('PRAGMA foreign_keys = ON', (err: Error | null) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
}

// Helper functions for database operations
export const dbHelpers = {
  // Users
  createUser: (id: string, email: string) => {
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO users (id, email) VALUES (?, ?)', [id, email], function (err: Error | null) {
        if (err) reject(err)
        else resolve({ id, email })
      })
    })
  },

  getUser: (id: string) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [id], (err: Error | null, row: any) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  },

  ensureUser: (id: string, email = '') => {
    return new Promise((resolve, reject) => {
      db.run('INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)', [id, email], function (err: Error | null) {
        if (err) reject(err)
        else resolve(undefined)
      })
    })
  },

  // Resumes
  saveResume: (
    id: string,
    userId: string,
    rawText: string,
    parsedData: any,
    fileName: string,
    version = 1,
    storagePath?: string | null
  ) => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO resumes (id, user_id, version, raw_text, parsed_data, file_name, storage_path) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, userId, version, rawText, JSON.stringify(parsedData), fileName, storagePath ?? null],
        function (err: Error | null) {
          if (err) reject(err)
          else resolve({ id, userId, version })
        }
      )
    })
  },

  getResumes: (userId: string) => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM resumes WHERE user_id = ? ORDER BY created_at DESC', [userId], (err: Error | null, rows: any) => {
        if (err) reject(err)
        else {
          const resumes = rows.map((row: any) => ({
            ...row,
            parsed_data: row.parsed_data ? JSON.parse(row.parsed_data) : {},
          }))
          resolve(resumes)
        }
      })
    })
  },

  getResumeById: (id: string) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM resumes WHERE id = ?', [id], (err: Error | null, row: any) => {
        if (err) reject(err)
        else if (!row) resolve(null)
        else
          resolve({
            ...row,
            parsed_data: row.parsed_data ? JSON.parse(row.parsed_data) : {},
          })
      })
    })
  },

  // Preferences
  savePreferences: (id: string, userId: string, preferences: any) => {
    return new Promise((resolve, reject) => {
      const {
        jobTitles = [],
        keywords = [],
        locationType,
        locationCities = [],
        locationCountries = [],
        salaryMin,
        salaryMax,
        companySize = [],
        maxApplicationsPerDay = 50,
        automationEnabled = false,
        screeningQuestions = {},
      } = preferences

      db.run(
        `INSERT INTO user_preferences (
          id, user_id, job_titles, keywords, location_type, location_cities,
          location_countries, salary_min, salary_max, company_size,
          max_applications_per_day, automation_enabled, screening_questions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          job_titles = excluded.job_titles,
          keywords = excluded.keywords,
          location_type = excluded.location_type,
          location_cities = excluded.location_cities,
          location_countries = excluded.location_countries,
          salary_min = excluded.salary_min,
          salary_max = excluded.salary_max,
          company_size = excluded.company_size,
          max_applications_per_day = excluded.max_applications_per_day,
          automation_enabled = excluded.automation_enabled,
          screening_questions = excluded.screening_questions,
          updated_at = CURRENT_TIMESTAMP`,
        [
          id,
          userId,
          JSON.stringify(jobTitles),
          JSON.stringify(keywords),
          locationType,
          JSON.stringify(locationCities),
          JSON.stringify(locationCountries),
          salaryMin,
          salaryMax,
          JSON.stringify(companySize),
          maxApplicationsPerDay,
          automationEnabled ? 1 : 0,
          JSON.stringify(screeningQuestions),
        ],
        function (err: Error | null) {
          if (err) reject(err)
          else resolve({ id, userId, ...preferences })
        }
      )
    })
  },

  getPreferences: (userId: string) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM user_preferences WHERE user_id = ?', [userId], (err: Error | null, row: any) => {
        if (err) reject(err)
        else if (!row) resolve(null)
        else {
          resolve({
            ...row,
            job_titles: JSON.parse(row.job_titles || '[]'),
            keywords: JSON.parse(row.keywords || '[]'),
            location_cities: JSON.parse(row.location_cities || '[]'),
            location_countries: JSON.parse(row.location_countries || '[]'),
            company_size: JSON.parse(row.company_size || '[]'),
            automation_enabled: row.automation_enabled === 1,
            screening_questions: JSON.parse(row.screening_questions || '{}'),
          })
        }
      })
    })
  },

  // Job postings
  saveJobPosting: (job: any) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO job_postings (id, title, company, url, location, salary, description, posted_date, match_score, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(url) DO UPDATE SET
           title = excluded.title,
           description = excluded.description,
           posted_date = excluded.posted_date,
           match_score = excluded.match_score,
           scraped_at = CURRENT_TIMESTAMP`,
        [
          job.id,
          job.title,
          job.company,
          job.url,
          job.location,
          job.salary,
          job.description,
          job.postedDate,
          job.matchScore || 0,
          job.status || 'new',
        ],
        function (err: Error | null) {
          if (err) reject(err)
          else resolve({ id: job.id })
        }
      )
    })
  },

  getJobPostings: (filters: any = {}) => {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM job_postings WHERE 1=1'
      const params: any[] = []

      if (filters.status) {
        query += ' AND status = ?'
        params.push(filters.status)
      }

      if (filters.minScore) {
        query += ' AND match_score >= ?'
        params.push(filters.minScore)
      }

      query += ' ORDER BY scraped_at DESC LIMIT ?'
      params.push(filters.limit || 100)

      db.all(query, params, (err: Error | null, rows: any) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })
  },

  // Applications
  createApplication: (id: string, userId: string, jobPostingId: string, resumeVersionId: string | null, coverLetter: string | null, notes: string | null) => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO applications (id, user_id, job_posting_id, resume_version_id, cover_letter, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [id, userId, jobPostingId, resumeVersionId, coverLetter, notes],
        function (err: Error | null) {
          if (err) reject(err)
          else resolve({ id, userId, jobPostingId })
        }
      )
    })
  },

  getApplications: (userId: string, filters: any = {}) => {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT a.*, j.title, j.company, j.url, j.location
        FROM applications a
        JOIN job_postings j ON a.job_posting_id = j.id
        WHERE a.user_id = ?
      `
      const params: any[] = [userId]

      if (filters.status) {
        query += ' AND a.status = ?'
        params.push(filters.status)
      }

      query += ' ORDER BY a.applied_at DESC'

      db.all(query, params, (err: Error | null, rows: any) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })
  },

  updateApplicationStatus: (applicationId: string, status: string) => {
    return new Promise((resolve, reject) => {
      db.run('UPDATE applications SET status = ? WHERE id = ?', [status, applicationId], function (err: Error | null) {
        if (err) reject(err)
        else resolve({ id: applicationId, status })
      })
    })
  },
}

// Initialize on module load
initDatabase().catch(console.error)
