-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create missing tables (skipping accounts as it already exists)
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS memories (
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

CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    room_id UUID REFERENCES rooms(id),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    state TEXT CHECK (state IN ('FOLLOWED', 'MUTED', NULL))
);

CREATE TABLE IF NOT EXISTS relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a UUID REFERENCES auth.users(id),
    user_b UUID REFERENCES auth.users(id),
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_a, user_b)
);

CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id),
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes if they don't exist
DO $$ 
BEGIN
    -- Vector similarity indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_memories_embedding') THEN
        CREATE INDEX idx_memories_embedding ON memories
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_memories_embedding_gemini') THEN
        CREATE INDEX idx_memories_embedding_gemini ON memories
        USING ivfflat (embedding_gemini vector_cosine_ops)
        WITH (lists = 100);
    END IF;

    -- Regular indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_memories_type_room') THEN
        CREATE INDEX idx_memories_type_room ON memories(type, room_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_memories_user') THEN
        CREATE INDEX idx_memories_user ON memories(user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_memories_agent') THEN
        CREATE INDEX idx_memories_agent ON memories(agent_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_memories_room') THEN
        CREATE INDEX idx_memories_room ON memories(room_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_participants_user') THEN
        CREATE INDEX idx_participants_user ON participants(user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_participants_room') THEN
        CREATE INDEX idx_participants_room ON participants(room_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_relationships_users') THEN
        CREATE INDEX idx_relationships_users ON relationships(user_a, user_b);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_goals_room') THEN
        CREATE INDEX idx_goals_room ON goals(room_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_goals_user') THEN
        CREATE INDEX idx_goals_user ON goals(user_id);
    END IF;
END $$;

-- Enable Row Level Security
DO $$ 
BEGIN
    -- Enable RLS for each table
    EXECUTE 'ALTER TABLE rooms ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE memories ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE participants ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE relationships ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE goals ENABLE ROW LEVEL SECURITY';
EXCEPTION
    WHEN others THEN NULL; -- Ignore errors if RLS is already enabled
END $$;

-- Create or replace RLS policies
DO $$ 
BEGIN
    -- Drop existing policies to avoid conflicts
    DROP POLICY IF EXISTS rooms_read_access ON rooms;
    DROP POLICY IF EXISTS memories_read_access ON memories;
    DROP POLICY IF EXISTS memories_insert_access ON memories;
    DROP POLICY IF EXISTS participants_read_access ON participants;
    DROP POLICY IF EXISTS relationships_read_access ON relationships;
    DROP POLICY IF EXISTS goals_read_access ON goals;

    -- Create new policies
    CREATE POLICY rooms_read_access ON rooms
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM participants 
                WHERE participants.room_id = rooms.id 
                AND participants.user_id = auth.uid()
            )
        );

    CREATE POLICY memories_read_access ON memories
        FOR SELECT USING (
            auth.uid() = user_id 
            OR auth.uid() = agent_id 
            OR EXISTS (
                SELECT 1 FROM participants 
                WHERE participants.room_id = memories.room_id 
                AND participants.user_id = auth.uid()
            )
        );

    CREATE POLICY memories_insert_access ON memories
        FOR INSERT WITH CHECK (
            auth.uid() = user_id 
            OR auth.uid() = agent_id
        );

    CREATE POLICY participants_read_access ON participants
        FOR SELECT USING (
            user_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM participants p2 
                WHERE p2.room_id = participants.room_id 
                AND p2.user_id = auth.uid()
            )
        );

    CREATE POLICY relationships_read_access ON relationships
        FOR SELECT USING (
            user_a = auth.uid() 
            OR user_b = auth.uid()
        );

    CREATE POLICY goals_read_access ON goals
        FOR SELECT USING (
            user_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM participants 
                WHERE participants.room_id = goals.room_id 
                AND participants.user_id = auth.uid()
            )
        );
END $$;

-- Create or replace vector similarity search function
CREATE OR REPLACE FUNCTION search_memories(
    p_embedding vector,
    p_match_threshold float,
    p_match_count int,
    p_room_id uuid DEFAULT NULL,
    p_agent_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    content jsonb,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.content,
        1 - (m.embedding <=> p_embedding) as similarity
    FROM memories m
    WHERE 
        CASE 
            WHEN p_room_id IS NOT NULL THEN m.room_id = p_room_id
            ELSE true
        END
        AND
        CASE 
            WHEN p_agent_id IS NOT NULL THEN m.agent_id = p_agent_id
            ELSE true
        END
        AND 1 - (m.embedding <=> p_embedding) > p_match_threshold
    ORDER BY m.embedding <=> p_embedding
    LIMIT p_match_count;
END;
$$; 