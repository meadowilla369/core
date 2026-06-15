-- Add lifecycle status to gates for soft-disable on event cancel/delete.

ALTER TABLE gates ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE gates DROP CONSTRAINT IF EXISTS gates_status_check;
ALTER TABLE gates ADD CONSTRAINT gates_status_check CHECK (status IN ('active', 'disabled'));
