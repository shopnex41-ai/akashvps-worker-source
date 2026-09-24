-- File/resource-only package policy. No bot-enforced date or runtime expiry.
ALTER TABLE packages ADD COLUMN max_files_per_project INTEGER NOT NULL DEFAULT 25;
ALTER TABLE packages ADD COLUMN cpu_policy TEXT NOT NULL DEFAULT 'provider-default';

UPDATE packages SET max_files_per_project=25, cpu_policy='provider-default' WHERE name='Basic';
UPDATE packages SET max_files_per_project=100, cpu_policy='provider-default' WHERE name='Developer';
UPDATE packages SET max_files_per_project=500, cpu_policy='provider-default' WHERE name='Premium';
