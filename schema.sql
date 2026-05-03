-- Users created on first login (Cloudflare Access email)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  user_name TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Courses: admin courses are is_system=1 and owner_user_id is NULL
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  owner_user_id INTEGER,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_courses_owner ON courses(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_courses_system ON courses(is_system);

-- Topics: ordered within a course
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_topics_course ON topics(course_id, sort_order);

-- Subtopics: ordered within a topic
CREATE TABLE IF NOT EXISTS subtopics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  link TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subtopics_topic ON subtopics(topic_id, sort_order);

-- Per-user progress for each subtopic
CREATE TABLE IF NOT EXISTS user_progress (
  user_id INTEGER NOT NULL,
  subtopic_id INTEGER NOT NULL,
  is_done INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, subtopic_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subtopic_id) REFERENCES subtopics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_subtopic ON user_progress(subtopic_id);
