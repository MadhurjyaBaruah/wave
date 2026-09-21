var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/server/app.ts
import express from "express";

// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  channelMembers: () => channelMembers,
  channels: () => channels,
  channelsRelations: () => channelsRelations,
  serverMembers: () => serverMembers,
  serverMembersRelations: () => serverMembersRelations,
  servers: () => servers,
  serversRelations: () => serversRelations,
  users: () => users,
  usersRelations: () => usersRelations
});
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  // Firebase Auth UID / Client ID
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow()
});
var servers = pgTable("servers", {
  id: text("id").primaryKey(),
  // e.g. srv_base_camp
  name: text("name").notNull(),
  description: text("description").notNull(),
  ownerId: text("owner_id").notNull(),
  inviteCode: text("invite_code").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var serverMembers = pgTable("server_members", {
  id: serial("id").primaryKey(),
  serverId: text("server_id").references(() => servers.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  // 'OWNER' | 'ADMIN' | 'MEMBER'
  createdAt: timestamp("created_at").defaultNow()
});
var channels = pgTable("channels", {
  id: text("id").primaryKey(),
  // e.g. chn_main
  serverId: text("server_id").references(() => servers.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  // 'PUBLIC' | 'PRIVATE'
  createdAt: timestamp("created_at").defaultNow()
});
var channelMembers = pgTable("channel_members", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id").references(() => channels.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var usersRelations = relations(users, ({ many }) => ({
  memberships: many(serverMembers)
}));
var serversRelations = relations(servers, ({ many }) => ({
  channels: many(channels),
  members: many(serverMembers)
}));
var channelsRelations = relations(channels, ({ one, many }) => ({
  server: one(servers, {
    fields: [channels.serverId],
    references: [servers.id]
  }),
  members: many(channelMembers)
}));
var serverMembersRelations = relations(serverMembers, ({ one }) => ({
  server: one(servers, {
    fields: [serverMembers.serverId],
    references: [servers.id]
  })
}));

// src/db/index.ts
var createPool = () => {
  if (!global._postgresPool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    let config;
    if (connectionString) {
      const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1") || connectionString.includes("sslmode=disable");
      const needsSsl = process.env.SQL_SSL === "true" || !isLocal && process.env.SQL_SSL !== "false";
      config = {
        connectionString,
        ssl: needsSsl ? { rejectUnauthorized: false } : false,
        max: 3,
        connectionTimeoutMillis: 8e3,
        idleTimeoutMillis: 2e4,
        query_timeout: 8e3,
        statement_timeout: 8e3,
        lock_timeout: 5e3
      };
    } else {
      const useSsl = process.env.SQL_SSL === "true";
      config = {
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER || process.env.SQL_ADMIN_USER,
        password: process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD,
        database: process.env.SQL_DB_NAME,
        port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
        max: 3,
        connectionTimeoutMillis: 8e3,
        idleTimeoutMillis: 2e4,
        query_timeout: 8e3,
        statement_timeout: 8e3,
        lock_timeout: 5e3
      };
    }
    global._postgresPool = new Pool(config);
    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return global._postgresPool;
};
var pool = createPool();
var db = drizzle(pool, { schema: schema_exports });

// src/db/queries.ts
import { eq, or, inArray, and } from "drizzle-orm";
var isSchemaInitialized = false;
async function ensureSchemaInitialized() {
  if (isSchemaInitialized) return;
  const hasDb = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SQL_HOST);
  if (!hasDb) return;
  try {
    const client = await pool.connect();
    try {
      const statements = [
        `CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          uid TEXT NOT NULL UNIQUE,
          username TEXT NOT NULL,
          display_name TEXT NOT NULL,
          avatar_url TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS servers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          owner_id TEXT NOT NULL,
          invite_code TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS server_members (
          id SERIAL PRIMARY KEY,
          server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL,
          role TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS channels (
          id TEXT PRIMARY KEY,
          server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS channel_members (
          id SERIAL PRIMARY KEY,
          channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_server_members_server_id ON server_members(server_id)`,
        `CREATE INDEX IF NOT EXISTS idx_server_members_user_id ON server_members(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_channels_server_id ON channels(server_id)`,
        `CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON channel_members(channel_id)`,
        `CREATE TABLE IF NOT EXISTS channel_presence (
          channel_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          user_data JSONB NOT NULL,
          last_seen_at TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (channel_id, user_id)
        )`,
        `CREATE TABLE IF NOT EXISTS channel_signals (
          id BIGSERIAL PRIMARY KEY,
          channel_id TEXT NOT NULL,
          from_user_id TEXT NOT NULL,
          to_user_id TEXT,
          type TEXT NOT NULL,
          payload JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_channel_signals_poll ON channel_signals(channel_id, id)`,
        `CREATE TABLE IF NOT EXISTS channel_locks (
          channel_id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          username TEXT NOT NULL,
          granted_at TIMESTAMP DEFAULT NOW()
        )`
      ];
      for (const statement of statements) {
        await client.query(statement).catch((err) => {
          console.warn("[PostgreSQL] Notice during schema statement:", err?.message || err);
        });
      }
      isSchemaInitialized = true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[PostgreSQL] Error in ensureSchemaInitialized:", err?.message || err);
  }
}
async function syncUserProfile(uid, username, displayName, avatarUrl) {
  try {
    const res = await db.insert(users).values({
      uid,
      username,
      displayName: displayName || username,
      avatarUrl: avatarUrl || ""
    }).onConflictDoUpdate({
      target: users.uid,
      set: {
        username,
        displayName: displayName || username,
        avatarUrl: avatarUrl || ""
      }
    }).returning();
    const u = res[0];
    return {
      id: u.uid,
      username: u.username,
      display_name: u.displayName,
      avatar_url: u.avatarUrl || void 0,
      created_at: u.createdAt ? u.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    console.error("Failed to sync user profile:", error);
    throw new Error("Database query failed while syncing user profile.", { cause: error });
  }
}
async function getServersForUser(userId) {
  try {
    if (!userId) {
      const all = await db.select().from(servers);
      return all.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        owner_id: s.ownerId,
        invite_code: s.inviteCode,
        created_at: s.createdAt ? s.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
      }));
    }
    const memberships = await db.select().from(serverMembers).where(eq(serverMembers.userId, userId));
    const serverIds = memberships.map((m) => m.serverId);
    const result = await db.select().from(servers).where(
      serverIds.length > 0 ? or(eq(servers.ownerId, userId), inArray(servers.id, serverIds)) : eq(servers.ownerId, userId)
    );
    return result.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      owner_id: s.ownerId,
      invite_code: s.inviteCode,
      created_at: s.createdAt ? s.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    }));
  } catch (error) {
    console.error("Failed to fetch servers for user:", error);
    throw new Error("Database query failed while fetching servers.", { cause: error });
  }
}
async function getServerById(serverId) {
  try {
    const res = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
    if (!res.length) return null;
    const s = res[0];
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      owner_id: s.ownerId,
      invite_code: s.inviteCode,
      created_at: s.createdAt ? s.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    console.error("Failed to get server by id:", error);
    throw new Error("Database query failed while retrieving server.", { cause: error });
  }
}
async function createServer(id, name, description, ownerId, inviteCode, defaultChannelId) {
  try {
    const res = await db.insert(servers).values({
      id,
      name,
      description,
      ownerId,
      inviteCode
    }).returning();
    await db.insert(serverMembers).values({
      serverId: id,
      userId: ownerId,
      role: "OWNER"
    });
    const defaultChanId = defaultChannelId || `chn_${Math.random().toString(36).substring(2, 9)}`;
    await db.insert(channels).values({
      id: defaultChanId,
      serverId: id,
      name: "general-dispatch",
      type: "PUBLIC"
    });
    const s = res[0];
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      owner_id: s.ownerId,
      invite_code: s.inviteCode,
      created_at: s.createdAt ? s.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    console.error("Failed to create server:", error);
    const detail = error?.message || String(error);
    throw new Error(`Failed to create server: ${detail}`, { cause: error });
  }
}
async function updateServer(serverId, name, description) {
  try {
    const updateData = {};
    if (name) updateData.name = name;
    if (description !== void 0) updateData.description = description;
    const res = await db.update(servers).set(updateData).where(eq(servers.id, serverId)).returning();
    if (!res.length) return null;
    const s = res[0];
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      owner_id: s.ownerId,
      invite_code: s.inviteCode,
      created_at: s.createdAt ? s.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    console.error("Failed to update server:", error);
    throw new Error("Database query failed while updating server.", { cause: error });
  }
}
async function deleteServer(serverId) {
  try {
    const res = await db.delete(servers).where(eq(servers.id, serverId)).returning();
    return res.length > 0;
  } catch (error) {
    console.error("Failed to delete server:", error);
    throw new Error("Database query failed while deleting server.", { cause: error });
  }
}
async function joinServerByInviteCode(inviteCode, userId) {
  try {
    const serverMatches = await db.select().from(servers).where(eq(servers.inviteCode, inviteCode)).limit(1);
    if (!serverMatches.length) {
      throw new Error("Invalid invite code");
    }
    const s = serverMatches[0];
    const existingMember = await db.select().from(serverMembers).where(
      and(eq(serverMembers.serverId, s.id), eq(serverMembers.userId, userId))
    ).limit(1);
    let memberRec;
    if (existingMember.length > 0) {
      memberRec = existingMember[0];
    } else {
      const inserted = await db.insert(serverMembers).values({
        serverId: s.id,
        userId,
        role: "MEMBER"
      }).returning();
      memberRec = inserted[0];
    }
    return {
      server: {
        id: s.id,
        name: s.name,
        description: s.description,
        owner_id: s.ownerId,
        invite_code: s.inviteCode,
        created_at: s.createdAt ? s.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
      },
      member: {
        id: memberRec.id,
        server_id: memberRec.serverId,
        user_id: memberRec.userId,
        role: memberRec.role,
        created_at: memberRec.createdAt ? memberRec.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
      }
    };
  } catch (error) {
    if (error.message === "Invalid invite code") throw error;
    console.error("Failed to join server by invite code:", error);
    throw new Error("Database query failed while joining server.", { cause: error });
  }
}
async function getServerChannels(serverId, userId) {
  try {
    const allChannels = await db.select().from(channels).where(eq(channels.serverId, serverId));
    if (!userId) {
      return allChannels.filter((c) => c.type === "PUBLIC").map((c) => ({
        id: c.id,
        server_id: c.serverId,
        name: c.name,
        type: c.type,
        created_at: c.createdAt ? c.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
      }));
    }
    const members = await db.select().from(serverMembers).where(
      and(eq(serverMembers.serverId, serverId), eq(serverMembers.userId, userId))
    );
    const isOwnerOrAdmin = members.some((m) => m.role === "OWNER" || m.role === "ADMIN");
    if (isOwnerOrAdmin) {
      return allChannels.map((c) => ({
        id: c.id,
        server_id: c.serverId,
        name: c.name,
        type: c.type,
        created_at: c.createdAt ? c.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
      }));
    }
    const privateMemberships = await db.select().from(channelMembers).where(eq(channelMembers.userId, userId));
    const allowedPrivateChannelIds = new Set(privateMemberships.map((pm) => pm.channelId));
    return allChannels.filter((c) => c.type === "PUBLIC" || allowedPrivateChannelIds.has(c.id)).map((c) => ({
      id: c.id,
      server_id: c.serverId,
      name: c.name,
      type: c.type,
      created_at: c.createdAt ? c.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    }));
  } catch (error) {
    console.error("Failed to get server channels:", error);
    throw new Error("Database query failed while fetching channels.", { cause: error });
  }
}
async function createChannel(id, serverId, name, type, createdByUserId) {
  try {
    const res = await db.insert(channels).values({
      id,
      serverId,
      name,
      type
    }).returning();
    if (type === "PRIVATE") {
      await db.insert(channelMembers).values({
        channelId: id,
        userId: createdByUserId
      });
    }
    const c = res[0];
    return {
      id: c.id,
      server_id: c.serverId,
      name: c.name,
      type: c.type,
      created_at: c.createdAt ? c.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    console.error("Failed to create channel:", error);
    throw new Error("Database query failed while creating channel.", { cause: error });
  }
}
async function deleteChannel(channelId) {
  try {
    const res = await db.delete(channels).where(eq(channels.id, channelId)).returning();
    return res.length > 0;
  } catch (error) {
    console.error("Failed to delete channel:", error);
    throw new Error("Database query failed while deleting channel.", { cause: error });
  }
}
async function getServerMembers(serverId) {
  try {
    const members = await db.select().from(serverMembers).where(eq(serverMembers.serverId, serverId));
    if (!members.length) return [];
    const userIds = members.map((m) => m.userId);
    const userProfiles = await db.select().from(users).where(inArray(users.uid, userIds));
    const profileMap = new Map(userProfiles.map((u) => [u.uid, u]));
    return members.map((m) => {
      const p = profileMap.get(m.userId);
      return {
        id: m.id,
        server_id: m.serverId,
        user_id: m.userId,
        role: m.role,
        created_at: m.createdAt ? m.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
        profile: p ? {
          id: p.uid,
          username: p.username,
          display_name: p.displayName,
          avatar_url: p.avatarUrl || void 0,
          created_at: p.createdAt ? p.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
        } : {
          id: m.userId,
          username: "operator",
          display_name: "Radio Operator",
          created_at: m.createdAt ? m.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
        }
      };
    });
  } catch (error) {
    console.error("Failed to get server members:", error);
    throw new Error("Database query failed while fetching members.", { cause: error });
  }
}
async function updateServerMemberRole(serverId, targetUserId, role) {
  try {
    const res = await db.update(serverMembers).set({ role }).where(and(eq(serverMembers.serverId, serverId), eq(serverMembers.userId, targetUserId))).returning();
    if (!res.length) return null;
    const m = res[0];
    return {
      id: m.id,
      server_id: m.serverId,
      user_id: m.userId,
      role: m.role,
      created_at: m.createdAt ? m.createdAt.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    console.error("Failed to update member role:", error);
    throw new Error("Database query failed while updating member role.", { cause: error });
  }
}
async function removeServerMember(serverId, targetUserId) {
  try {
    const res = await db.delete(serverMembers).where(and(eq(serverMembers.serverId, serverId), eq(serverMembers.userId, targetUserId))).returning();
    return res.length > 0;
  } catch (error) {
    console.error("Failed to remove server member:", error);
    throw new Error("Database query failed while removing member.", { cause: error });
  }
}
async function joinOrUpdatePresence(channelId, userId, userData) {
  try {
    await pool.query(
      `INSERT INTO channel_presence (channel_id, user_id, user_data, last_seen_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (channel_id, user_id)
       DO UPDATE SET 
         user_data = CASE 
           WHEN ($3->>'username') IS NOT NULL AND ($3->>'username') != 'Operator' AND ($3->>'username') != '' 
           THEN $3 
           ELSE channel_presence.user_data 
         END,
         last_seen_at = NOW()`,
      [channelId, userId, JSON.stringify(userData)]
    );
  } catch (err) {
    console.warn("[DB Signaling] Presence update error:", err?.message || err);
  }
}
async function leaveChannelPresence(channelId, userId) {
  try {
    await pool.query(
      `DELETE FROM channel_presence WHERE channel_id = $1 AND user_id = $2`,
      [channelId, userId]
    );
  } catch (err) {
    console.warn("[DB Signaling] Presence leave error:", err?.message || err);
  }
}
async function getChannelPresenceUsers(channelId) {
  try {
    const res = await pool.query(
      `SELECT user_id, user_data, last_seen_at
       FROM channel_presence
       WHERE channel_id = $1 AND last_seen_at > NOW() - INTERVAL '15 seconds'`,
      [channelId]
    );
    return res.rows.map((row) => {
      const parsed = typeof row.user_data === "string" ? JSON.parse(row.user_data) : row.user_data;
      return {
        user_id: row.user_id,
        username: parsed?.username || "Operator",
        display_name: parsed?.display_name || parsed?.username || "Operator",
        avatar_url: parsed?.avatar_url,
        connected_at: row.last_seen_at
      };
    });
  } catch (err) {
    console.warn("[DB Signaling] Presence fetch error:", err?.message || err);
    return [];
  }
}
async function insertChannelSignal(channelId, fromUserId, toUserId, type, payload) {
  try {
    await pool.query(
      `INSERT INTO channel_signals (channel_id, from_user_id, to_user_id, type, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [channelId, fromUserId, toUserId, type, JSON.stringify(payload ?? {})]
    );
    pool.query(`DELETE FROM channel_signals WHERE created_at < NOW() - INTERVAL '2 minutes'`).catch(() => {
    });
  } catch (err) {
    console.warn("[DB Signaling] Signal insert error:", err?.message || err);
  }
}
async function fetchChannelSignals(channelId, userId, afterId) {
  try {
    const res = await pool.query(
      `SELECT id, channel_id, from_user_id, to_user_id, type, payload, created_at
       FROM channel_signals
       WHERE channel_id = $1
         AND id > $2
         AND from_user_id != $3
         AND (to_user_id IS NULL OR to_user_id = $3)
       ORDER BY id ASC
       LIMIT 50`,
      [channelId, afterId, userId]
    );
    let maxId = afterId;
    const signals = res.rows.map((r) => {
      const idNum = Number(r.id);
      if (idNum > maxId) maxId = idNum;
      return {
        id: idNum,
        channel_id: r.channel_id,
        from_user_id: r.from_user_id,
        to_user_id: r.to_user_id,
        type: r.type,
        payload: typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload,
        created_at: r.created_at
      };
    });
    return { maxId, signals };
  } catch (err) {
    console.warn("[DB Signaling] Signal fetch error:", err?.message || err);
    return { maxId: afterId, signals: [] };
  }
}
async function acquireSpeakerLock(channelId, userId, username) {
  try {
    const current = await pool.query(
      `SELECT user_id, username, granted_at
       FROM channel_locks
       WHERE channel_id = $1`,
      [channelId]
    );
    const row = current.rows[0];
    const isStale = row && Date.now() - new Date(row.granted_at).getTime() > 6e4;
    if (!row || row.user_id === userId || isStale) {
      await pool.query(
        `INSERT INTO channel_locks (channel_id, user_id, username, granted_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (channel_id)
         DO UPDATE SET user_id = $2, username = $3, granted_at = NOW()`,
        [channelId, userId, username]
      );
      return { granted: true, activeSpeaker: { userId, username } };
    }
    return {
      granted: false,
      activeSpeaker: { userId: row.user_id, username: row.username }
    };
  } catch (err) {
    console.warn("[DB Signaling] Lock error:", err?.message || err);
    return { granted: true, activeSpeaker: { userId, username } };
  }
}
async function releaseSpeakerLock(channelId, userId) {
  try {
    await pool.query(
      `DELETE FROM channel_locks WHERE channel_id = $1 AND user_id = $2`,
      [channelId, userId]
    );
  } catch (err) {
    console.warn("[DB Signaling] Lock release error:", err?.message || err);
  }
}
async function getActiveSpeakerLock(channelId) {
  try {
    const res = await pool.query(
      `SELECT user_id, username, granted_at
       FROM channel_locks
       WHERE channel_id = $1 AND granted_at > NOW() - INTERVAL '60 seconds'`,
      [channelId]
    );
    if (!res.rows.length) return null;
    return {
      userId: res.rows[0].user_id,
      username: res.rows[0].username
    };
  } catch {
    return null;
  }
}

// src/server/app.ts
var app = express();
app.use(express.json());
app.use((req, res, next) => {
  if (!req.url.startsWith("/api")) {
    req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }
  next();
});
app.use((req, res, next) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({
        error: "Request timed out. The database connection is slow or unavailable. Please try again.",
        hint: "If this persists, check your DATABASE_URL in Vercel settings. Use the Supabase Connection Pooler URL (aws-0-*.pooler.supabase.com:6543) not the direct connection."
      });
    }
  }, 8e3);
  res.on("finish", () => clearTimeout(timeout));
  res.on("close", () => clearTimeout(timeout));
  next();
});
var initializedPromise = null;
app.use(async (req, res, next) => {
  if (!initializedPromise) {
    initializedPromise = ensureSchemaInitialized().catch((e) => {
      console.warn("[Server] Schema auto-init notice:", e?.message || e);
    });
  }
  next();
});
function formatDbError(err) {
  const cause = err?.cause;
  const causeMsg = cause?.message || (typeof cause === "string" ? cause : "");
  const detail = err?.detail || cause?.detail || "";
  const full = `${err?.message || ""} ${causeMsg} ${detail}`.toLowerCase();
  if (full.includes("relation") && full.includes("does not exist")) {
    return "Database tables not found. Please execute schema.sql in your Supabase SQL Editor.";
  }
  if (full.includes("econnrefused")) {
    return "Database connection refused. Please ensure DATABASE_URL is set in your Vercel Environment Variables.";
  }
  if (full.includes("etimedout") || full.includes("timeout") || full.includes("enetunreach")) {
    return "Database connection timed out. If connecting from Vercel to Supabase, use the Connection Pooler URL (aws-0-*.pooler.supabase.com:6543) instead of direct connection, as Vercel does not support direct IPv6.";
  }
  if (full.includes("password authentication failed")) {
    return "Database password incorrect. Please check your Supabase password inside DATABASE_URL.";
  }
  if (causeMsg && !err.message.includes(causeMsg)) {
    return `${err.message} (${causeMsg})`;
  }
  return err?.message || "Database error occurred";
}
app.get("/api/health", async (req, res) => {
  let dbStatus = "disconnected";
  let dbError = null;
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
  if (hasDatabaseUrl) {
    try {
      const client = await pool.connect();
      try {
        await client.query("SELECT 1");
        dbStatus = "connected";
      } finally {
        client.release();
      }
    } catch (e) {
      dbStatus = "error";
      dbError = e?.message || String(e);
    }
  }
  res.json({
    status: "ok",
    database: {
      status: dbStatus,
      error: dbError,
      hasDatabaseUrl
    },
    service: "WAVE Walkie-Talkie Backend (PostgreSQL & Vercel Serverless Ready)",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/profiles/sync", async (req, res) => {
  const { id, username, display_name, avatar_url } = req.body;
  if (!id || !username) {
    return res.status(400).json({ error: "Missing id or username" });
  }
  try {
    const profile = await syncUserProfile(id, username, display_name, avatar_url);
    res.json(profile);
  } catch (err) {
    console.error("Error syncing profile to database:", err);
    res.status(500).json({ error: formatDbError(err) });
  }
});
app.get("/api/servers", async (req, res) => {
  const userId = req.query.userId || req.query.user_id;
  try {
    const userServers = await getServersForUser(userId);
    res.json(userServers);
  } catch (err) {
    console.error("Error fetching servers:", err);
    res.status(500).json({ error: formatDbError(err) });
  }
});
app.post("/api/servers", async (req, res) => {
  const { id, invite_code, channel_id, name, description, owner_id } = req.body;
  if (!name || !owner_id) {
    return res.status(400).json({ error: "Name and owner_id required" });
  }
  const randomCode = invite_code && typeof invite_code === "string" ? invite_code.trim().toUpperCase() : "WAVE-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  const serverId = id && typeof id === "string" ? id : "srv_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
  const defaultChanId = channel_id && typeof channel_id === "string" ? channel_id : "chn_" + Math.random().toString(36).substring(2, 9);
  try {
    const newServer = await createServer(
      serverId,
      name.trim().toUpperCase(),
      description?.trim() || "",
      owner_id,
      randomCode,
      defaultChanId
    );
    const channels2 = await getServerChannels(newServer.id, owner_id);
    res.status(201).json({
      server: newServer,
      channels: channels2
    });
  } catch (err) {
    console.error("Error creating server:", err);
    res.status(500).json({ error: formatDbError(err) });
  }
});
app.get("/api/servers/:id", async (req, res) => {
  const { id } = req.params;
  const userId = req.query.userId || req.query.user_id;
  try {
    const server = await getServerById(id);
    if (!server) {
      return res.status(404).json({ error: "Server not found" });
    }
    const members = await getServerMembers(id);
    const channels2 = await getServerChannels(id, userId);
    res.json({
      server,
      members,
      channels: channels2
    });
  } catch (err) {
    console.error("Error fetching server details:", err);
    res.status(500).json({ error: "Failed to fetch server details" });
  }
});
app.get("/api/servers/:id/channels", async (req, res) => {
  const { id } = req.params;
  const userId = req.query.userId || req.query.user_id;
  try {
    const server = await getServerById(id);
    if (!server) {
      return res.status(404).json({ error: "Server not found" });
    }
    const accessibleChannels = await getServerChannels(id, userId);
    res.json(accessibleChannels);
  } catch (err) {
    console.error("Error fetching channels:", err);
    res.status(500).json({ error: "Failed to fetch channels" });
  }
});
app.get("/api/servers/:id/members", async (req, res) => {
  const { id } = req.params;
  try {
    const server = await getServerById(id);
    if (!server) {
      return res.status(404).json({ error: "Server not found" });
    }
    const members = await getServerMembers(id);
    res.json(members);
  } catch (err) {
    console.error("Error fetching members:", err);
    res.status(500).json({ error: "Failed to fetch members" });
  }
});
app.patch("/api/servers/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description, user_id } = req.body;
  try {
    const members = await getServerMembers(id);
    const member = members.find((m) => m.user_id === user_id);
    if (!member || member.role !== "OWNER" && member.role !== "ADMIN") {
      return res.status(403).json({ error: "Unauthorized" });
    }
    const updated = await updateServer(id, name?.trim()?.toUpperCase(), description?.trim());
    if (!updated) return res.status(404).json({ error: "Server not found" });
    res.json(updated);
  } catch (err) {
    console.error("Error updating server:", err);
    res.status(500).json({ error: "Failed to update server" });
  }
});
app.delete("/api/servers/:id", async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  try {
    const server = await getServerById(id);
    if (!server) return res.status(404).json({ error: "Server not found" });
    if (server.owner_id !== user_id) {
      return res.status(403).json({ error: "Only server owner can delete this server" });
    }
    await deleteServer(id);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting server:", err);
    res.status(500).json({ error: "Failed to delete server" });
  }
});
app.post("/api/servers/join", async (req, res) => {
  const { invite_code, user_id } = req.body;
  if (!invite_code || !user_id) {
    return res.status(400).json({ error: "Invite code and user_id required" });
  }
  try {
    const result = await joinServerByInviteCode(invite_code.trim().toUpperCase(), user_id);
    res.json({ success: true, server: result.server });
  } catch (err) {
    if (err.message === "Invalid invite code") {
      return res.status(404).json({ error: "SERVER NOT FOUND: Invalid or expired invite code" });
    }
    console.error("Error joining server:", err);
    res.status(500).json({ error: "Failed to join server" });
  }
});
app.post("/api/servers/:id/leave", async (req, res) => {
  const { id } = req.params;
  const userId = req.body?.user_id || req.query.user_id || req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: "user_id required" });
  }
  try {
    const server = await getServerById(id);
    if (!server) return res.status(404).json({ error: "Server not found" });
    if (server.owner_id === userId) {
      return res.status(400).json({ error: "Owner cannot leave their own server. Delete it or transfer ownership." });
    }
    await removeServerMember(id, userId);
    res.json({ success: true });
  } catch (err) {
    console.error("Error leaving server:", err);
    res.status(500).json({ error: "Failed to leave server" });
  }
});
app.post("/api/servers/:id/channels", async (req, res) => {
  const { id } = req.params;
  const { name, type, user_id } = req.body;
  if (!name) return res.status(400).json({ error: "Channel name required" });
  try {
    const members = await getServerMembers(id);
    const member = members.find((m) => m.user_id === user_id);
    if (!member || member.role !== "OWNER" && member.role !== "ADMIN") {
      return res.status(403).json({ error: "Unauthorized to create channels" });
    }
    const cleanName = name.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
    const newChanId = "chn_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    const newChannel = await createChannel(
      newChanId,
      id,
      cleanName,
      type === "PRIVATE" ? "PRIVATE" : "PUBLIC",
      user_id
    );
    res.status(201).json(newChannel);
  } catch (err) {
    console.error("Error creating channel:", err);
    res.status(500).json({ error: "Failed to create channel" });
  }
});
app.delete("/api/channels/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await deleteChannel(id);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting channel:", err);
    res.status(500).json({ error: "Failed to delete channel" });
  }
});
app.delete("/api/servers/:id/members/:targetUserId", async (req, res) => {
  const { id, targetUserId } = req.params;
  const callerUserId = req.body?.user_id || req.query.user_id || req.query.userId || targetUserId;
  try {
    const server = await getServerById(id);
    if (!server) return res.status(404).json({ error: "Server not found" });
    const isSelf = targetUserId === callerUserId;
    const members = await getServerMembers(id);
    const operator = members.find((m) => m.user_id === callerUserId);
    if (!isSelf) {
      if (!operator || operator.role !== "OWNER" && operator.role !== "ADMIN") {
        return res.status(403).json({ error: "Unauthorized to remove members" });
      }
    }
    if (targetUserId === server.owner_id) {
      return res.status(400).json({ error: "Cannot remove server owner" });
    }
    await removeServerMember(id, targetUserId);
    res.json({ success: true });
  } catch (err) {
    console.error("Error removing member:", err);
    res.status(500).json({ error: "Failed to remove member" });
  }
});
app.patch("/api/servers/:id/members/:targetUserId/role", async (req, res) => {
  const { id, targetUserId } = req.params;
  const { user_id, role } = req.body;
  try {
    const server = await getServerById(id);
    if (!server) return res.status(404).json({ error: "Server not found" });
    if (server.owner_id !== user_id) {
      return res.status(403).json({ error: "Only owner can change member roles" });
    }
    if (role === "ADMIN" || role === "MEMBER") {
      const updated = await updateServerMemberRole(id, targetUserId, role);
      return res.json(updated);
    }
    res.status(400).json({ error: "Invalid role" });
  } catch (err) {
    console.error("Error updating member role:", err);
    res.status(500).json({ error: "Failed to update member role" });
  }
});
app.post("/api/channels/:id/join", async (req, res) => {
  const { id } = req.params;
  const { user } = req.body;
  if (!user || !user.id) {
    return res.status(400).json({ error: "User object required" });
  }
  await joinOrUpdatePresence(id, user.id, user);
  res.json({ success: true });
});
app.post("/api/channels/:id/leave", async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  if (user_id) {
    await leaveChannelPresence(id, user_id);
    await releaseSpeakerLock(id, user_id);
  }
  res.json({ success: true });
});
app.post("/api/channels/:id/signal", async (req, res) => {
  const { id } = req.params;
  const { from_user_id, to_user_id, type, payload } = req.body;
  if (!from_user_id || !type) {
    return res.status(400).json({ error: "from_user_id and type are required" });
  }
  await insertChannelSignal(id, from_user_id, to_user_id || null, type, payload);
  res.json({ success: true });
});
app.get("/api/channels/:id/poll", async (req, res) => {
  const { id } = req.params;
  const userId = req.query.user_id || req.query.userId;
  const afterId = parseInt(req.query.after_id || "0", 10);
  const username = req.query.username || "";
  const displayName = req.query.display_name || username || "";
  if (!userId) {
    return res.status(400).json({ error: "user_id is required" });
  }
  await joinOrUpdatePresence(id, userId, {
    id: userId,
    username: username || "Operator",
    display_name: displayName || username || "Operator"
  });
  const [users2, lock, signalData] = await Promise.all([
    getChannelPresenceUsers(id),
    getActiveSpeakerLock(id),
    fetchChannelSignals(id, userId, afterId)
  ]);
  const activeSpeaker = lock ? { userId: lock.userId, username: lock.username } : null;
  const formattedUsers = users2.map((u) => ({
    ...u,
    is_transmitting: activeSpeaker ? activeSpeaker.userId === u.user_id : false
  }));
  res.json({
    users: formattedUsers,
    active_speaker: activeSpeaker,
    signals: signalData.signals,
    max_id: signalData.maxId
  });
});
app.post("/api/channels/:id/lock", async (req, res) => {
  const { id } = req.params;
  const { user_id, username, action } = req.body;
  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }
  if (action === "release") {
    await releaseSpeakerLock(id, user_id);
    await insertChannelSignal(id, user_id, null, "speaker_lock_released", {});
    return res.json({ success: true, released: true });
  }
  const result = await acquireSpeakerLock(id, user_id, username || "Operator");
  if (result.granted) {
    await insertChannelSignal(id, user_id, null, "speaker_active", {
      speaker: result.activeSpeaker
    });
  }
  res.json(result);
});
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
});
var app_default = app;

// src/server/handler.ts
function handler(req, res) {
  return app_default(req, res);
}
export {
  handler as default
};
