
const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "records.db"));

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function validateRecord(body) {
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const department = String(body.department || "").trim();

  if (!name) {
    return { error: "Name is required." };
  }

  if (name.length > 100 || email.length > 150 ||
      department.length > 100) {
    return { error: "One or more fields are too long." };
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  return { name, email, department };
}

function getRecord(id) {
  return db.prepare("SELECT * FROM records WHERE id = ?").get(id);
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Record API is running" });
});

app.get("/api/records", (req, res) => {
  const search = String(req.query.search || "").trim();

  const records = search
    ? db.prepare(`
        SELECT * FROM records
        WHERE name LIKE ? OR email LIKE ? OR department LIKE ?
        ORDER BY id
      `).all(`%${search}%`, `%${search}%`, `%${search}%`)
    : db.prepare("SELECT * FROM records ORDER BY id").all();

  res.json(records);
});

app.get("/api/stats", (req, res) => {
  const total = db.prepare(
    "SELECT COUNT(*) AS count FROM records"
  ).get().count;

  const departments = db.prepare(`
    SELECT COUNT(DISTINCT department) AS count
    FROM records
    WHERE department <> ''
  `).get().count;

  const latest = db.prepare(`
    SELECT * FROM records ORDER BY id DESC LIMIT 5
  `).all();

  res.json({ total, departments, latest });
});

app.get("/api/records/:id", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid record ID." });
  }

  const record = getRecord(id);

  if (!record) {
    return res.status(404).json({ error: "Record not found." });
  }

  res.json(record);
});

app.post("/api/records", (req, res) => {
  const data = validateRecord(req.body);

  if (data.error) {
    return res.status(400).json(data);
  }

  const result = db.prepare(`
    INSERT INTO records (name, email, department)
    VALUES (?, ?, ?)
  `).run(data.name, data.email, data.department);

  res.status(201).json(getRecord(Number(result.lastInsertRowid)));
});

app.post("/api/records/insert-at", (req, res) => {
  const data = validateRecord(req.body);
  const position = Number(req.body.position);

  if (data.error) {
    return res.status(400).json(data);
  }

  if (!Number.isSafeInteger(position) || position < 1) {
    return res.status(400).json({
      error: "Position must be a positive whole number."
    });
  }

  const insert = db.transaction(() => {
    const count = db.prepare(
      "SELECT COUNT(*) AS count FROM records"
    ).get().count;

    if (position > count + 1) {
      throw new Error(`Position must be between 1 and ${count + 1}.`);
    }

    // Shift logical ordering to make room for the new record.
    // Negative IDs are temporary; original IDs are restored.
    const rows = db.prepare(
      "SELECT id FROM records ORDER BY id"
    ).all();

    const insertRow = db.prepare(`
      INSERT INTO records (name, email, department)
      VALUES (?, ?, ?)
    `);

    const created = insertRow.run(
      data.name, data.email, data.department
    );

    const newId = Number(created.lastInsertRowid);
    const ordered = rows.map(row => row.id);
    ordered.splice(position - 1, 0, newId);

    // Persist display order separately in a stable order column.
    db.exec(`
      CREATE TABLE IF NOT EXISTS record_order (
        record_id INTEGER PRIMARY KEY,
        sort_order INTEGER NOT NULL
      )
    `);

    const saveOrder = db.prepare(`
      INSERT INTO record_order (record_id, sort_order)
      VALUES (?, ?)
      ON CONFLICT(record_id)
      DO UPDATE SET sort_order = excluded.sort_order
    `);

    ordered.forEach((id, index) => saveOrder.run(id, index + 1));
    return getRecord(newId);
  });

  try {
    const record = insert();
    res.status(201).json(record);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/records/:id", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid record ID." });
  }

  if (!getRecord(id)) {
    return res.status(404).json({ error: "Record not found." });
  }

  const data = validateRecord(req.body);

  if (data.error) {
    return res.status(400).json(data);
  }

  db.prepare(`
    UPDATE records
    SET name = ?, email = ?, department = ?
    WHERE id = ?
  `).run(data.name, data.email, data.department, id);

  res.json(getRecord(id));
});

app.delete("/api/records/:id", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid record ID." });
  }

  const remove = db.transaction(() => {
    const existing = getRecord(id);
    if (!existing) return false;

    db.prepare("DELETE FROM records WHERE id = ?").run(id);

    // Re-number the custom display order after deletion.
    const orderTable = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name = 'record_order'
    `).get();

    if (orderTable) {
      db.prepare("DELETE FROM record_order WHERE record_id = ?").run(id);

      const ordered = db.prepare(`
        SELECT record_id FROM record_order ORDER BY sort_order
      `).all();

      const updateOrder = db.prepare(`
        UPDATE record_order SET sort_order = ? WHERE record_id = ?
      `);

      ordered.forEach((row, index) =>
        updateOrder.run(index + 1, row.record_id)
      );
    }

    return true;
  });

  if (!remove()) {
    return res.status(404).json({ error: "Record not found." });
  }

  res.json({ message: "Record deleted successfully." });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`Record API running at http://localhost:${PORT}`);
});
