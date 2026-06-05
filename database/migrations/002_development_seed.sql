INSERT INTO users (name, email, password_hash, role, permissions, is_active)
VALUES (
  'Administrador Postinder',
  'admin@postinder.local',
  '$2a$10$mZ7UBznnaEVfUJQySHYiVOq3Bc9C77zqe2z4JQG6mlPOHFU3YYPae',
  'admin',
  ARRAY['dashboard', 'clients', 'posts/new', 'approvals', 'feed', 'insights', 'users', 'email', 'integrations'],
  true
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO clients (name, email, password_hash, whatsapp, segment, color, deadline_days, is_active)
VALUES (
  'Acme Corp',
  'cliente@example.com',
  '$2a$10$V7UOjiO7mSRpSHNDYdRHYOWiWqqbG3HS9I/aytMm7ZYOfYpUj7UKS',
  '(11) 99999-9999',
  'Tecnologia',
  '#A7014B',
  7,
  true
)
ON CONFLICT (email) DO NOTHING;
