import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Registered / synced users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID / Client ID
  username: text('username').notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Servers / Tactical Frequencies
export const servers = pgTable('servers', {
  id: text('id').primaryKey(), // e.g. srv_base_camp
  name: text('name').notNull(),
  description: text('description').notNull(),
  ownerId: text('owner_id').notNull(),
  inviteCode: text('invite_code').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Server Memberships & Roles
export const serverMembers = pgTable('server_members', {
  id: serial('id').primaryKey(),
  serverId: text('server_id').references(() => servers.id, { onDelete: 'cascade' }).notNull(),
  userId: text('user_id').notNull(),
  role: text('role').notNull(), // 'OWNER' | 'ADMIN' | 'MEMBER'
  createdAt: timestamp('created_at').defaultNow(),
});

// Voice Channels
export const channels = pgTable('channels', {
  id: text('id').primaryKey(), // e.g. chn_main
  serverId: text('server_id').references(() => servers.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'PUBLIC' | 'PRIVATE'
  createdAt: timestamp('created_at').defaultNow(),
});

// Private Channel Access Memberships
export const channelMembers = pgTable('channel_members', {
  id: serial('id').primaryKey(),
  channelId: text('channel_id').references(() => channels.id, { onDelete: 'cascade' }).notNull(),
  userId: text('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(serverMembers),
}));

export const serversRelations = relations(servers, ({ many }) => ({
  channels: many(channels),
  members: many(serverMembers),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  server: one(servers, {
    fields: [channels.serverId],
    references: [servers.id],
  }),
  members: many(channelMembers),
}));

export const serverMembersRelations = relations(serverMembers, ({ one }) => ({
  server: one(servers, {
    fields: [serverMembers.serverId],
    references: [servers.id],
  }),
}));
