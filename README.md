# Smart Campus Issue Monitoring Platform

A complete student/admin issue-reporting portal built with React, Vite, Express, and Node.js.

## Run locally
1. Install Node.js LTS.
2. Extract this folder and open it in VS Code.
3. Run `START-SMART-CAMPUS.bat` on Windows, or use the terminal:
   ```bash
   npm install
   npm run install:all
   npm run dev
   ```
4. Open http://localhost:5173

No MySQL or MongoDB setup is needed. The API stores user accounts and issues in `backend/data/store.json` for simple local development.

## Features
- Student account registration and login
- Report campus issues with category, location, description, and priority
- Track Pending, In Progress, Resolved, and Rejected statuses
- Responsive dashboard, search, filters, and issue details
- Admin API endpoints for reviewing issues and changing statuses
- Password hashing and signed JWT sessions

## Admin access
For a local demo, register a student account first. To enable the admin promotion helper, add `ADMIN_PROMOTION_KEY=your-private-key` to `backend/.env`, restart the API, and POST to `/api/dev/promote-admin` with JSON `{ "email": "registered-email", "key": "your-private-key" }`. Sign out and back in. Do not enable this helper on a public deployment without proper access controls.

## GitHub
This project includes a `.gitignore` for dependencies, secrets, and build output. Do not commit real secrets or private data. The included `.env` contains only local development defaults; replace `JWT_SECRET` before deployment.
