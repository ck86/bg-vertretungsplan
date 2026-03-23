-- Run once in the Neon SQL Editor (or psql) after creating the project.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  class_label TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS push_sub_ep_class
  ON push_subscriptions (endpoint, class_label);

CREATE TABLE IF NOT EXISTS class_plan_fingerprints (
  class_label TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);
