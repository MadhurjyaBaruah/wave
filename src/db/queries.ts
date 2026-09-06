import { db } from './index.ts';
import { users, servers, serverMembers, channels, channelMembers } from './schema.ts';
import { eq, or, inArray, and } from 'drizzle-orm';

export interface DbProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
}

export interface DbServer {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
}

export interface DbChannel {
  id: string;
  server_id: string;
  name: string;
  type: 'PUBLIC' | 'PRIVATE';
  created_at: string;
}

export interface DbMember {
  id: number;
  server_id: string;
  user_id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  created_at: string;
  profile?: DbProfile;
}

// Ensure default dispatch net exists in PostgreSQL
export async function seedInitialDataIfEmpty() {
  try {
    const existingServers = await db.select().from(servers).limit(1);
    if (existingServers.length > 0) {
      return;
    }

    const defaultOwnerId = 'usr_radio_operator';
    const defaultServerId = 'srv_base_camp';

    // Seed default user profiles
    await db.insert(users).values([
      {
        uid: defaultOwnerId,
        username: 'radio_chief',
        displayName: 'Chief Dispatcher',
        avatarUrl: '',
      },
      {
        uid: 'usr_alpha',
        username: 'alpha_lead',
        displayName: 'Unit 1 // Alpha',
        avatarUrl: '',
      },
      {
        uid: 'usr_bravo',
        username: 'bravo_scout',
        displayName: 'Unit 2 // Bravo',
        avatarUrl: '',
      },
    ]).onConflictDoNothing();

    // Seed default server
    await db.insert(servers).values({
      id: defaultServerId,
      name: 'DISPATCH FREQ // 01',
      description: 'Central Tactical Frequency & Dispatch Net',
      ownerId: defaultOwnerId,
      inviteCode: 'WAVE-TAC01',
    }).onConflictDoNothing();

    // Seed server members
    await db.insert(serverMembers).values([
      { serverId: defaultServerId, userId: defaultOwnerId, role: 'OWNER' },
      { serverId: defaultServerId, userId: 'usr_alpha', role: 'ADMIN' },
      { serverId: defaultServerId, userId: 'usr_bravo', role: 'MEMBER' },
    ]).onConflictDoNothing();

    // Seed channels
    await db.insert(channels).values([
      { id: 'chn_main', serverId: defaultServerId, name: 'general-dispatch', type: 'PUBLIC' },
      { id: 'chn_tactical', serverId: defaultServerId, name: 'tactical-ops', type: 'PUBLIC' },
      { id: 'chn_scout', serverId: defaultServerId, name: 'scout-recon', type: 'PUBLIC' },
      { id: 'chn_command', serverId: defaultServerId, name: 'command-secure', type: 'PRIVATE' },
    ]).onConflictDoNothing();

    // Seed channel members for private channel
    await db.insert(channelMembers).values([
      { channelId: 'chn_command', userId: defaultOwnerId },
      { channelId: 'chn_command', userId: 'usr_alpha' },
    ]).onConflictDoNothing();

    console.log('[PostgreSQL] Successfully seeded initial radio frequencies and channels.');
  } catch (err) {
    console.error('[PostgreSQL] Seeding check error:', err);
  }
}

// Synchronize or update a user profile
export async function syncUserProfile(uid: string, username: string, displayName: string, avatarUrl?: string): Promise<DbProfile> {
  try {
    const res = await db.insert(users)
      .values({
        uid,
        username,
        displayName: displayName || username,
        avatarUrl: avatarUrl || '',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          username,
          displayName: displayName || username,
          avatarUrl: avatarUrl || '',
        },
      })
      .returning();

    const u = res[0];
    return {
      id: u.uid,
      username: u.username,
      display_name: u.displayName,
      avatar_url: u.avatarUrl || undefined,
      created_at: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to sync user profile:', error);
    throw new Error('Database query failed while syncing user profile.', { cause: error });
  }
}

// Get servers accessible to a user
export async function getServersForUser(userId?: string): Promise<DbServer[]> {
  try {
    if (!userId) {
      const all = await db.select().from(servers);
      return all.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        owner_id: s.ownerId,
        invite_code: s.inviteCode,
        created_at: s.createdAt ? s.createdAt.toISOString() : new Date().toISOString(),
      }));
    }

    const memberships = await db.select().from(serverMembers).where(eq(serverMembers.userId, userId));
    const serverIds = memberships.map((m) => m.serverId);

    const result = await db.select().from(servers).where(
      serverIds.length > 0
        ? or(eq(servers.ownerId, userId), inArray(servers.id, serverIds))
        : eq(servers.ownerId, userId)
    );

    return result.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      owner_id: s.ownerId,
      invite_code: s.inviteCode,
      created_at: s.createdAt ? s.createdAt.toISOString() : new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Failed to fetch servers for user:', error);
    throw new Error('Database query failed while fetching servers.', { cause: error });
  }
}

// Get single server by ID
export async function getServerById(serverId: string): Promise<DbServer | null> {
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
      created_at: s.createdAt ? s.createdAt.toISOString() : new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to get server by id:', error);
    throw new Error('Database query failed while retrieving server.', { cause: error });
  }
}

// Create new server
export async function createServer(
  id: string,
  name: string,
  description: string,
  ownerId: string,
  inviteCode: string
): Promise<DbServer> {
  try {
    const res = await db.insert(servers).values({
      id,
      name,
      description,
      ownerId,
      inviteCode,
    }).returning();

    // Automatically add owner as OWNER member
    await db.insert(serverMembers).values({
      serverId: id,
      userId: ownerId,
      role: 'OWNER',
    });

    // Automatically create default general-dispatch channel
    const defaultChanId = `chn_${Math.random().toString(36).substring(2, 9)}`;
    await db.insert(channels).values({
      id: defaultChanId,
      serverId: id,
      name: 'general-dispatch',
      type: 'PUBLIC',
    });

    const s = res[0];
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      owner_id: s.ownerId,
      invite_code: s.inviteCode,
      created_at: s.createdAt ? s.createdAt.toISOString() : new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to create server:', error);
    throw new Error('Database query failed while creating server.', { cause: error });
  }
}

// Update server details
export async function updateServer(
  serverId: string,
  name?: string,
  description?: string
): Promise<DbServer | null> {
  try {
    const updateData: { name?: string; description?: string } = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    const res = await db.update(servers)
      .set(updateData)
      .where(eq(servers.id, serverId))
      .returning();

    if (!res.length) return null;
    const s = res[0];
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      owner_id: s.ownerId,
      invite_code: s.inviteCode,
      created_at: s.createdAt ? s.createdAt.toISOString() : new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to update server:', error);
    throw new Error('Database query failed while updating server.', { cause: error });
  }
}

// Delete server
export async function deleteServer(serverId: string): Promise<boolean> {
  try {
    const res = await db.delete(servers).where(eq(servers.id, serverId)).returning();
    return res.length > 0;
  } catch (error) {
    console.error('Failed to delete server:', error);
    throw new Error('Database query failed while deleting server.', { cause: error });
  }
}

// Join server via invite code
export async function joinServerByInviteCode(inviteCode: string, userId: string): Promise<{ server: DbServer; member: DbMember }> {
  try {
    const serverMatches = await db.select().from(servers).where(eq(servers.inviteCode, inviteCode)).limit(1);
    if (!serverMatches.length) {
      throw new Error('Invalid invite code');
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
        role: 'MEMBER',
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
        created_at: s.createdAt ? s.createdAt.toISOString() : new Date().toISOString(),
      },
      member: {
        id: memberRec.id,
        server_id: memberRec.serverId,
        user_id: memberRec.userId,
        role: memberRec.role as any,
        created_at: memberRec.createdAt ? memberRec.createdAt.toISOString() : new Date().toISOString(),
      },
    };
  } catch (error: any) {
    if (error.message === 'Invalid invite code') throw error;
    console.error('Failed to join server by invite code:', error);
    throw new Error('Database query failed while joining server.', { cause: error });
  }
}

// Fetch channels for a server with role and privacy checks
export async function getServerChannels(serverId: string, userId?: string): Promise<DbChannel[]> {
  try {
    const allChannels = await db.select().from(channels).where(eq(channels.serverId, serverId));
    if (!userId) {
      return allChannels.filter((c) => c.type === 'PUBLIC').map((c) => ({
        id: c.id,
        server_id: c.serverId,
        name: c.name,
        type: c.type as any,
        created_at: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
      }));
    }

    const members = await db.select().from(serverMembers).where(
      and(eq(serverMembers.serverId, serverId), eq(serverMembers.userId, userId))
    );
    const isOwnerOrAdmin = members.some((m) => m.role === 'OWNER' || m.role === 'ADMIN');

    if (isOwnerOrAdmin) {
      return allChannels.map((c) => ({
        id: c.id,
        server_id: c.serverId,
        name: c.name,
        type: c.type as any,
        created_at: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
      }));
    }

    const privateMemberships = await db.select().from(channelMembers).where(eq(channelMembers.userId, userId));
    const allowedPrivateChannelIds = new Set(privateMemberships.map((pm) => pm.channelId));

    return allChannels
      .filter((c) => c.type === 'PUBLIC' || allowedPrivateChannelIds.has(c.id))
      .map((c) => ({
        id: c.id,
        server_id: c.serverId,
        name: c.name,
        type: c.type as any,
        created_at: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
      }));
  } catch (error) {
    console.error('Failed to get server channels:', error);
    throw new Error('Database query failed while fetching channels.', { cause: error });
  }
}

// Create channel
export async function createChannel(
  id: string,
  serverId: string,
  name: string,
  type: 'PUBLIC' | 'PRIVATE',
  createdByUserId: string
): Promise<DbChannel> {
  try {
    const res = await db.insert(channels).values({
      id,
      serverId,
      name,
      type,
    }).returning();

    if (type === 'PRIVATE') {
      await db.insert(channelMembers).values({
        channelId: id,
        userId: createdByUserId,
      });
    }

    const c = res[0];
    return {
      id: c.id,
      server_id: c.serverId,
      name: c.name,
      type: c.type as any,
      created_at: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to create channel:', error);
    throw new Error('Database query failed while creating channel.', { cause: error });
  }
}

// Delete channel
export async function deleteChannel(channelId: string): Promise<boolean> {
  try {
    const res = await db.delete(channels).where(eq(channels.id, channelId)).returning();
    return res.length > 0;
  } catch (error) {
    console.error('Failed to delete channel:', error);
    throw new Error('Database query failed while deleting channel.', { cause: error });
  }
}

// Fetch members of a server
export async function getServerMembers(serverId: string): Promise<DbMember[]> {
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
        role: m.role as any,
        created_at: m.createdAt ? m.createdAt.toISOString() : new Date().toISOString(),
        profile: p
          ? {
              id: p.uid,
              username: p.username,
              display_name: p.displayName,
              avatar_url: p.avatarUrl || undefined,
              created_at: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
            }
          : {
              id: m.userId,
              username: 'operator',
              display_name: 'Radio Operator',
              created_at: m.createdAt ? m.createdAt.toISOString() : new Date().toISOString(),
            },
      };
    });
  } catch (error) {
    console.error('Failed to get server members:', error);
    throw new Error('Database query failed while fetching members.', { cause: error });
  }
}

// Update server member role
export async function updateServerMemberRole(
  serverId: string,
  targetUserId: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
): Promise<DbMember | null> {
  try {
    const res = await db.update(serverMembers)
      .set({ role })
      .where(and(eq(serverMembers.serverId, serverId), eq(serverMembers.userId, targetUserId)))
      .returning();

    if (!res.length) return null;
    const m = res[0];
    return {
      id: m.id,
      server_id: m.serverId,
      user_id: m.userId,
      role: m.role as any,
      created_at: m.createdAt ? m.createdAt.toISOString() : new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to update member role:', error);
    throw new Error('Database query failed while updating member role.', { cause: error });
  }
}

// Remove member from server (kick or self-leave)
export async function removeServerMember(serverId: string, targetUserId: string): Promise<boolean> {
  try {
    const res = await db.delete(serverMembers)
      .where(and(eq(serverMembers.serverId, serverId), eq(serverMembers.userId, targetUserId)))
      .returning();
    return res.length > 0;
  } catch (error) {
    console.error('Failed to remove server member:', error);
    throw new Error('Database query failed while removing member.', { cause: error });
  }
}
