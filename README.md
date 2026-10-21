
# RecordFlow — Record Management System

A full-stack Record Management System built with React, Node.js,
Express and SQLite.

## Features

- Create and display records
- Insert a record at a selected position
- Search by name, email or department
- Edit and delete records
- Dashboard statistics
- Persistent SQLite database
- Responsive dashboard UI
- REST API with input validation

## Technology Stack

- Frontend: React, Vite, CSS
- Backend: Node.js, Express
- Database: SQLite using better-sqlite3
- Icons: Lucide React

## Prerequisites

Install Node.js LTS from https://nodejs.org/

Verify installation:

    node -v
    npm -v

## Installation

Open the project folder in VS Code.

### 1. Start the backend

Open a terminal:

    cd backend
    npm install
    npm run dev

The API runs at http://localhost:5000

### 2. Start the frontend

Open a second terminal from the project root:

    cd frontend
    npm install
    npm run dev

Open http://localhost:5173 in your browser.

The SQLite database is created automatically in backend/data.

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/health | Check API status |
| GET | /api/records | List records |
| GET | /api/records?search=abc | Search records |
| GET | /api/records/:id | Get one record |
| GET | /api/stats | Dashboard statistics |
| POST | /api/records | Create a record |
| POST | /api/records/insert-at | Insert at a position |
| PUT | /api/records/:id | Update a record |
| DELETE | /api/records/:id | Delete a record |

## Database

The SQLite database is created automatically when the
backend starts. Records remain saved after restarting the server.

The local database file is ignored by Git so personal test
data is not accidentally uploaded.

## GitHub

Create an empty GitHub repository, then run these commands
from the project root:

    git init
    git add .
    git commit -m "Add RecordFlow full-stack project"
    git branch -M main
    git remote add origin https://github.com/YOUR-USERNAME/record-management-system.git
    git push -u origin main

Replace YOUR-USERNAME with your GitHub username.

## Viva Explanation

RecordFlow is a full-stack application that manages records.
React provides the user interface. Express exposes REST API
endpoints. The backend validates input and performs database
operations using SQLite.

The primary key uniquely identifies each record. CRUD means
Create, Read, Update and Delete. Searching uses SQL queries,
and SQLite provides persistent storage.

## Limitations

This is a college mini-project. It does not include login,
role-based permissions, or production deployment security.
