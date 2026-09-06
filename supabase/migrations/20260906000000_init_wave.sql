-- ==============================================================================
-- WAVE — INTERNET WALKIE-TALKIE PLATFORM
-- PRODUCTION SUPABASE DATABASE SCHEMA & ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS & DOMAINS
DO $$ BEGIN
    CREATE TYPE server_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE channel_type AS ENUM ('PUBLIC', 'PRIVATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT username_min_length CHECK (char_length(username) >= 3),
    CONSTRAINT username_alphanumeric CHECK (username ~* '^[a-zA-Z0-9_-]+$')
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- 4. SERVERS TABLE
CREATE TABLE IF NOT EXISTS public.servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    invite_code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT server_name_length CHECK (char_length(name) >= 2)
);

CREATE INDEX IF NOT EXISTS idx_servers_owner_id ON public.servers(owner_id);
CREATE INDEX IF NOT EXISTS idx_servers_invite_code ON public.servers(invite_code);

-- 5. SERVER_MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.server_members (
    server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (server_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_server_members_user ON public.server_members(user_id);
CREATE INDEX IF NOT EXISTS idx_server_members_server ON public.server_members(server_id);

-- 6. CHANNELS TABLE
CREATE TABLE IF NOT EXISTS public.channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'PUBLIC' CHECK (type IN ('PUBLIC', 'PRIVATE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT channel_name_clean CHECK (char_length(name) >= 1)
);

CREATE INDEX IF NOT EXISTS idx_channels_server_id ON public.channels(server_id);

-- 7. CHANNEL_MEMBERS TABLE (For private channel access control)
CREATE TABLE IF NOT EXISTS public.channel_members (
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_members_user ON public.channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON public.channel_members(channel_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;

-- Helper security functions
CREATE OR REPLACE FUNCTION public.is_server_member(s_id UUID, u_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.server_members 
        WHERE server_id = s_id AND user_id = u_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_server_admin_or_owner(s_id UUID, u_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.server_members 
        WHERE server_id = s_id AND user_id = u_id AND role IN ('OWNER', 'ADMIN')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --- PROFILES POLICIES ---
CREATE POLICY "Public profiles are readable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- --- SERVERS POLICIES ---
CREATE POLICY "Members can view servers they belong to"
    ON public.servers FOR SELECT
    TO authenticated
    USING (
        owner_id = auth.uid() OR
        public.is_server_member(id, auth.uid())
    );

CREATE POLICY "Authenticated users can create a server"
    ON public.servers FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners and Admins can update their server"
    ON public.servers FOR UPDATE
    TO authenticated
    USING (public.is_server_admin_or_owner(id, auth.uid()));

CREATE POLICY "Only Owners can delete their server"
    ON public.servers FOR DELETE
    TO authenticated
    USING (auth.uid() = owner_id);

-- --- SERVER_MEMBERS POLICIES ---
CREATE POLICY "Server members can view member lists of their servers"
    ON public.server_members FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR
        public.is_server_member(server_id, auth.uid())
    );

CREATE POLICY "Users can join a server or Admins can add members"
    ON public.server_members FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id OR
        public.is_server_admin_or_owner(server_id, auth.uid())
    );

CREATE POLICY "Server owners can update member roles"
    ON public.server_members FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.servers
            WHERE id = server_id AND owner_id = auth.uid()
        )
    );

CREATE POLICY "Members can leave or Admins can kick members"
    ON public.server_members FOR DELETE
    TO authenticated
    USING (
        auth.uid() = user_id OR
        public.is_server_admin_or_owner(server_id, auth.uid())
    );

-- --- CHANNELS POLICIES ---
CREATE POLICY "Members can view public channels or permitted private channels"
    ON public.channels FOR SELECT
    TO authenticated
    USING (
        public.is_server_member(server_id, auth.uid()) AND (
            type = 'PUBLIC' OR
            EXISTS (
                SELECT 1 FROM public.channel_members
                WHERE channel_id = channels.id AND user_id = auth.uid()
            ) OR
            public.is_server_admin_or_owner(server_id, auth.uid())
        )
    );

CREATE POLICY "Admins and Owners can create channels"
    ON public.channels FOR INSERT
    TO authenticated
    WITH CHECK (public.is_server_admin_or_owner(server_id, auth.uid()));

CREATE POLICY "Admins and Owners can update channels"
    ON public.channels FOR UPDATE
    TO authenticated
    USING (public.is_server_admin_or_owner(server_id, auth.uid()));

CREATE POLICY "Admins and Owners can delete channels"
    ON public.channels FOR DELETE
    TO authenticated
    USING (public.is_server_admin_or_owner(server_id, auth.uid()));

-- --- CHANNEL_MEMBERS POLICIES ---
CREATE POLICY "Authorized users can view private channel membership"
    ON public.channel_members FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.channels c
            WHERE c.id = channel_id AND public.is_server_admin_or_owner(c.server_id, auth.uid())
        )
    );

CREATE POLICY "Admins and Owners can add members to private channels"
    ON public.channel_members FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.channels c
            WHERE c.id = channel_id AND public.is_server_admin_or_owner(c.server_id, auth.uid())
        )
    );

CREATE POLICY "Admins and Owners can remove members from private channels"
    ON public.channel_members FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.channels c
            WHERE c.id = channel_id AND public.is_server_admin_or_owner(c.server_id, auth.uid())
        )
    );

-- ==============================================================================
-- AUTOMATIC HANDLERS & TRIGGERS
-- ==============================================================================

-- Trigger to auto-create public profile when user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    clean_username TEXT;
BEGIN
    clean_username := COALESCE(
        NEW.raw_user_meta_data->>'username',
        'operator_' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 6)
    );
    INSERT INTO public.profiles (id, username, display_name, avatar_url)
    VALUES (
        NEW.id,
        clean_username,
        COALESCE(NEW.raw_user_meta_data->>'display_name', clean_username),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Atomic function to create a new server, add owner to server_members, and create initial channels
CREATE OR REPLACE FUNCTION public.create_server_with_defaults(
    server_name TEXT,
    server_desc TEXT DEFAULT '',
    invite_code TEXT DEFAULT ''
)
RETURNS UUID AS $$
DECLARE
    new_server_id UUID;
    code TEXT;
BEGIN
    code := invite_code;
    IF code = '' OR code IS NULL THEN
        code := 'WAVE-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    END IF;

    INSERT INTO public.servers (name, description, owner_id, invite_code)
    VALUES (server_name, server_desc, auth.uid(), code)
    RETURNING id INTO new_server_id;

    -- Add owner as OWNER in server_members
    INSERT INTO public.server_members (server_id, user_id, role)
    VALUES (new_server_id, auth.uid(), 'OWNER');

    -- Create default public channels
    INSERT INTO public.channels (server_id, name, type)
    VALUES 
        (new_server_id, 'general', 'PUBLIC'),
        (new_server_id, 'radio-shack', 'PUBLIC');

    RETURN new_server_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
