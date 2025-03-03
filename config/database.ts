import type { DatabaseAdapter } from "@elizaos/core";
import { ModelProviderName } from "@elizaos/core";
import SupabaseDatabaseAdapter from "@elizaos-plugins/adapter-supabase";

// Database configuration
export const databaseConfig = {
    supabase: {
        url: process.env.SUPABASE_URL as string,
        apiKey: process.env.SUPABASE_SERVICE_API_KEY as string,
        // Circuit breaker configuration for fault tolerance
        circuitBreaker: {
            failureThreshold: 5,
            resetTimeout: 60000, // 1 minute
            halfOpenMaxAttempts: 3,
        },
    },
    // Vector dimensions for different models
    vectorDimensions: {
        [ModelProviderName.OPENROUTER]: 1536, // OpenAI compatible models
        [ModelProviderName.GEMINI]: 768, // Gemini's embedding dimension
    },
    // Memory configuration
    memory: {
        matchThreshold: 0.8,
        maxMemories: 10,
        retentionPeriod: "30d",
    },
} as const;

// Create database adapter instance
export function createDatabaseAdapter(): DatabaseAdapter {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_API_KEY) {
        throw new Error(
            "Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_API_KEY environment variables."
        );
    }

    return new SupabaseDatabaseAdapter(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_API_KEY,
        databaseConfig.supabase.circuitBreaker
    );
}

// Memory table schema for reference
/*
Required Supabase SQL setup:

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create memories table with vector support
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    content JSONB NOT NULL,
    embedding vector(1536), -- For OpenRouter/OpenAI
    embedding_gemini vector(768), -- For Gemini
    user_id UUID REFERENCES auth.users(id),
    agent_id UUID REFERENCES auth.users(id),
    room_id UUID REFERENCES rooms(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_unique BOOLEAN DEFAULT true NOT NULL
);

-- Create vector similarity search index
CREATE INDEX idx_memories_embedding ON memories
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX idx_memories_embedding_gemini ON memories
    USING ivfflat (embedding_gemini vector_cosine_ops)
    WITH (lists = 100);

-- Add RLS policies
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memories_read_access"
    ON memories FOR SELECT
    USING (auth.uid() = user_id OR auth.uid() = agent_id);

CREATE POLICY "memories_insert_access"
    ON memories FOR INSERT
    WITH CHECK (auth.uid() = user_id OR auth.uid() = agent_id);
*/
