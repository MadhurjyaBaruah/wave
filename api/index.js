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
      const needsSsl = connectionString.includes("sslmode=require") || connectionString.includes("ssl=true");
      config = {
        connectionString,
        ssl: needsSsl ? { rejectUnauthorized: false } : false,
        max: 10,
        connectionTimeoutMillis: 15e3
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
        max: 10,
        connectionTimeoutMillis: 15e3
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
async function createServer(id, name, description, ownerId, inviteCode) {
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
    const defaultChanId = `chn_${Math.random().toString(36).substring(2, 9)}`;
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
    throw new Error("Database query failed while creating server.", { cause: error });
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

// src/server/app.ts
var app = express();
app.use(express.json());
function formatDbError(err) {
  const msg = err?.message || String(err);
  if (msg.includes("relation") && msg.includes("does not exist")) {
    return "Database tables not found. Please execute schema.sql in your Supabase/PostgreSQL SQL Editor.";
  }
  if (msg.includes("connection") || msg.includes("ECONNREFUSED") || msg.includes("timeout") || msg.includes("password authentication failed")) {
    return `Database connection failed: ${msg}. Please check DATABASE_URL in your hosting settings.`;
  }
  return msg || "Database error occurred";
}
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
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
  const { name, description, owner_id } = req.body;
  if (!name || !owner_id) {
    return res.status(400).json({ error: "Name and owner_id required" });
  }
  const randomCode = "WAVE-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  const serverId = "srv_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
  try {
    const newServer = await createServer(
      serverId,
      name.trim().toUpperCase(),
      description?.trim() || "",
      owner_id,
      randomCode
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
  const { user_id } = req.body;
  try {
    const server = await getServerById(id);
    if (!server) return res.status(404).json({ error: "Server not found" });
    if (server.owner_id === user_id) {
      return res.status(400).json({ error: "Owner cannot leave their own server. Delete it or transfer ownership." });
    }
    await removeServerMember(id, user_id);
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
  const { user_id } = req.body;
  try {
    const server = await getServerById(id);
    if (!server) return res.status(404).json({ error: "Server not found" });
    const isSelf = targetUserId === user_id;
    const members = await getServerMembers(id);
    const operator = members.find((m) => m.user_id === user_id);
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
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
});
var app_default = app;

// api/index.ts
function handler(req, res) {
  return app_default(req, res);
}
export {
  handler as default
};
