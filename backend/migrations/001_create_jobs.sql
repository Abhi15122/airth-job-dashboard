CREATE TABLE jobs (
  id uuid PRIMARY KEY,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120 AND title ~ '[^[:space:]]'),
  type text NOT NULL CHECK (char_length(type) BETWEEN 1 AND 50 AND type ~ '[^[:space:]]'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
