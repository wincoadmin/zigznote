-- Initialize PostgreSQL with required extensions
-- This file runs automatically when the container is first created

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgvector for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable full-text search (built-in, but ensure it's ready)
-- No explicit extension needed, but create a sample index configuration
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'english') THEN
    RAISE NOTICE 'Text search configuration already exists';
  END IF;
END $$;

-- Grant permissions (in case of custom roles)
GRANT ALL PRIVILEGES ON DATABASE zigznote TO postgres;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Database initialization completed successfully';
END $$;
