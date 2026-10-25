
"use strict";

const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "careerhub.db");

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const db = new sqlite3.Database(DB_PATH, (error) => {
  if (error) {
    console.error("Could not open SQLite database:", error.message);
    process.exit(1);
  }

  console.log("Connected to SQLite database.");
});

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) return reject(error);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) return reject(error);
      resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) return reject(error);
      resolve(rows);
    });
  });
}

function parseSkills(value) {
  if (Array.isArray(value)) {
    return value.map(String).map((skill) => skill.trim()).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // A comma-separated string is also accepted.
    }

    return value.split(",").map((skill) => skill.trim()).filter(Boolean);
  }

  return [];
}

function formatJob(row) {
  if (!row) return row;

  return {
    ...row,
    id: Number(row.id),
    salary: Number(row.salary || 0),
    skills: parseSkills(row.skills)
  };
}

function validText(value, maxLength = 3000) {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength;
}

function validJob(body) {
  return (
    validText(body.title, 100) &&
    validText(body.company, 100) &&
    validText(body.location, 150) &&
    validText(body.category, 80) &&
    validText(body.type, 40) &&
    validText(body.description, 3000) &&
    body.salary !== "" &&
    body.salary !== null &&
    body.salary !== undefined &&
    Number.isFinite(Number(body.salary)) &&
    Number(body.salary) >= 0
  );
}

function jobValues(body) {
  return [
    body.title.trim(),
    body.company.trim(),
    body.location.trim(),
    body.category.trim(),
    body.type.trim(),
    Number(body.salary),
    body.description.trim(),
    JSON.stringify(parseSkills(body.skills))
  ];
}

const seedJobs = [
  {
    title: "Frontend Developer",
    company: "PixelCraft Technologies",
    location: "Chennai",
    category: "IT",
    type: "Full Time",
    salary: 45000,
    description: "Build responsive web interfaces using HTML, CSS and JavaScript. Collaborate with the product and design teams.",
    skills: ["HTML", "CSS", "JavaScript"]
  },
  {
    title: "Junior Software Developer",
    company: "TechNova Solutions",
    location: "Coimbatore",
    category: "IT",
    type: "Full Time",
    salary: 40000,
    description: "Help develop, test and maintain software applications. Suitable for candidates starting their software careers.",
    skills: ["JavaScript", "Problem Solving", "Git"]
  },
  {
    title: "Web Development Intern",
    company: "BrightByte Labs",
    location: "Remote",
    category: "IT",
    type: "Internship",
    salary: 12000,
    description: "Learn web development by working on supervised projects and assisting the development team.",
    skills: ["HTML", "CSS", "JavaScript"]
  },
  {
    title: "UI/UX Design Intern",
    company: "CreativeNest Studio",
    location: "Bengaluru",
    category: "Design",
    type: "Internship",
    salary: 15000,
    description: "Assist with wireframes, prototypes and user-friendly interface designs.",
    skills: ["Figma", "Wireframing", "Design"]
  },
  {
    title: "Digital Marketing Executive",
    company: "GrowthWave Media",
    location: "Chennai",
    category: "Marketing",
    type: "Full Time",
    salary: 32000,
    description: "Support online campaigns, content planning and performance reporting.",
    skills: ["SEO", "Content", "Analytics"]
  },
  {
    title: "Data Analyst Intern",
    company: "InsightBridge",
    location: "Remote",
    category: "IT",
    type: "Internship",
    salary: 18000,
    description: "Assist with data cleaning, spreadsheet analysis and basic reporting.",
    skills: ["Excel", "SQL", "Data Analysis"]
  },
  {
    title: "HR Assistant",
    company: "PeopleFirst Group",
    location: "Coimbatore",
    category: "HR",
    type: "Part Time",
    salary: 20000,
    description: "Assist with recruitment coordination, interview scheduling and employee records.",
    skills: ["Communication", "Organisation"]
  },
  {
    title: "Accounts Assistant",
    company: "Summit Finance",
    location: "Chennai",
    category: "Finance",
    type: "Full Time",
    salary: 28000,
    description: "Support routine accounts work, document preparation and financial record keeping.",
    skills: ["Excel", "Accounting", "Accuracy"]
  }
];

async function initialiseDatabase() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT NOT NULL,
      category TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Full Time',
      salary REAL NOT NULL DEFAULT 0,
      description TEXT NOT NULL,
      skills TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      applicant_name TEXT NOT NULL,
      applicant_email TEXT NOT NULL,
      applicant_phone TEXT DEFAULT '',
      resume_url TEXT DEFAULT '',
      applied_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'Applied',
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    )
  `);

  const count = await dbGet("SELECT COUNT(*) AS total FROM jobs");

  if (count.total === 0) {
    for (const job of seedJobs) {
      await dbRun(
        `INSERT INTO jobs
        (title, company, location, category, type, salary, description, skills)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        jobValues(job)
      );
    }

    console.log("Sample jobs added to the database.");
  }

  console.log("Database tables are ready.");
}

/* -----------------------------------------
   HOME AND HEALTH CHECK
----------------------------------------- */

app.get("/", (req, res) => {
  res.send("CareerHub API is running!");
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "CareerHub API is running." });
});

/* -----------------------------------------
   JOB ROUTES
----------------------------------------- */

// Get all jobs
app.get("/api/jobs", async (req, res, next) => {
  try {
    const rows = await dbAll(
      "SELECT * FROM jobs ORDER BY datetime(created_at) DESC, id DESC"
    );

    res.json(rows.map(formatJob));
  } catch (error) {
    next(error);
  }
});

// Get one job
app.get("/api/jobs/:id", async (req, res, next) => {
  try {
    const job = await dbGet(
      "SELECT * FROM jobs WHERE id = ?",
      [req.params.id]
    );

    if (!job) {
      return res.status(404).json({ message: "Job not found." });
    }

    res.json(formatJob(job));
  } catch (error) {
    next(error);
  }
});

// Add a job
app.post("/api/jobs", async (req, res, next) => {
  try {
    if (!validJob(req.body)) {
      return res.status(400).json({
        message: "Please provide valid values for all required job fields."
      });
    }

    const result = await dbRun(
      `INSERT INTO jobs
      (title, company, location, category, type, salary, description, skills)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      jobValues(req.body)
    );

    const job = await dbGet(
      "SELECT * FROM jobs WHERE id = ?",
      [result.lastID]
    );

    res.status(201).json({
      message: "Job created successfully.",
      job: formatJob(job)
    });
  } catch (error) {
    next(error);
  }
});

// Edit a job
app.put("/api/jobs/:id", async (req, res, next) => {
  try {
    if (!validJob(req.body)) {
      return res.status(400).json({
        message: "Please provide valid values for all required job fields."
      });
    }

    const existing = await dbGet(
      "SELECT id FROM jobs WHERE id = ?",
      [req.params.id]
    );

    if (!existing) {
      return res.status(404).json({ message: "Job not found." });
    }

    await dbRun(
      `UPDATE jobs SET
        title = ?,
        company = ?,
        location = ?,
        category = ?,
        type = ?,
        salary = ?,
        description = ?,
        skills = ?
       WHERE id = ?`,
      [...jobValues(req.body), req.params.id]
    );

    const updated = await dbGet(
      "SELECT * FROM jobs WHERE id = ?",
      [req.params.id]
    );

    res.json({
      message: "Job updated successfully.",
      job: formatJob(updated)
    });
  } catch (error) {
    next(error);
  }
});

// Delete a job
app.delete("/api/jobs/:id", async (req, res, next) => {
  try {
    const result = await dbRun(
      "DELETE FROM jobs WHERE id = ?",
      [req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ message: "Job not found." });
    }

    res.json({ message: "Job deleted successfully." });
  } catch (error) {
    next(error);
  }
});

/* -----------------------------------------
   APPLICATION ROUTES
----------------------------------------- */

// List applications, including their job titles and companies
app.get("/api/applications", async (req, res, next) => {
  try {
    const rows = await dbAll(`
      SELECT
        applications.id,
        applications.job_id,
        applications.applicant_name,
        applications.applicant_email,
        applications.applicant_phone,
        applications.resume_url,
        applications.applied_at,
        applications.status,
        jobs.title AS job_title,
        jobs.company AS company
      FROM applications
      LEFT JOIN jobs ON jobs.id = applications.job_id
      ORDER BY datetime(applications.applied_at) DESC, applications.id DESC
    `);

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// Submit a job application
app.post("/api/applications", async (req, res, next) => {
  try {
    const {
      job_id,
      applicant_name,
      applicant_email,
      applicant_phone = "",
      resume_url = ""
    } = req.body;

    if (
      job_id === undefined ||
      !validText(String(applicant_name || ""), 100) ||
      !validText(String(applicant_email || ""), 150) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(applicant_email || "")) ||
      String(applicant_phone).length > 20 ||
      String(resume_url).length > 1000
    ) {
      return res.status(400).json({
        message: "Please provide a valid job ID, name and email."
      });
    }

    const job = await dbGet(
      "SELECT id FROM jobs WHERE id = ?",
      [job_id]
    );

    if (!job) {
      return res.status(404).json({ message: "Job not found." });
    }

    const result = await dbRun(
      `INSERT INTO applications
      (job_id, applicant_name, applicant_email, applicant_phone, resume_url)
      VALUES (?, ?, ?, ?, ?)`,
      [
        job_id,
        String(applicant_name).trim(),
        String(applicant_email).trim(),
        String(applicant_phone).trim(),
        String(resume_url).trim()
      ]
    );

    const application = await dbGet(
      `SELECT applications.*, jobs.title AS job_title, jobs.company AS company
       FROM applications
       LEFT JOIN jobs ON jobs.id = applications.job_id
       WHERE applications.id = ?`,
      [result.lastID]
    );

    res.status(201).json({
      message: "Application submitted successfully.",
      application
    });
  } catch (error) {
    next(error);
  }
});

// Update application status
app.patch("/api/applications/:id/status", async (req, res, next) => {
  try {
    const allowedStatuses = [
      "Applied",
      "Under Review",
      "Shortlisted",
      "Rejected"
    ];

    const { status } = req.body;

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status. Choose a supported application status."
      });
    }

    const result = await dbRun(
      "UPDATE applications SET status = ? WHERE id = ?",
      [status, req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        message: "Application not found."
      });
    }

    res.json({ message: "Application status updated successfully.", status });
  } catch (error) {
    next(error);
  }
});

/* -----------------------------------------
   ERROR HANDLING
----------------------------------------- */

app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

app.use((error, req, res, next) => {
  console.error("API error:", error.message);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    message: "A server error occurred. Check the VS Code terminal."
  });
});

/* -----------------------------------------
   START SERVER AFTER DATABASE SETUP
----------------------------------------- */

initialiseDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log("-----------------------------------");
      console.log("CareerHub backend is running!");
      console.log(`Local URL: http://localhost:${PORT}`);
      console.log(`API URL:   http://localhost:${PORT}/api`);
      console.log(`Database:  ${DB_PATH}`);
      console.log("-----------------------------------");
    });
  })
  .catch((error) => {
    console.error("Database setup failed:", error.message);
    db.close();
    process.exit(1);
  });
