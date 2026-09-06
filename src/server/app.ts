import express from 'express';
import * as dbQueries from '../db/queries.ts';

const app = express();

app.use(express.json());

// --- REST API ROUTES ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'WAVE Walkie-Talkie Backend (PostgreSQL & Vercel Serverless Ready)',
    timestamp: new Date().toISOString(),
  });
});

// Profile endpoints - backed by Cloud SQL users table
app.post('/api/profiles/sync', async (req, res) => {
  const { id, username, display_name, avatar_url } = req.body;
  if (!id || !username) {
    return res.status(400).json({ error: 'Missing id or username' });
  }
  try {
    const profile = await dbQueries.syncUserProfile(id, username, display_name, avatar_url);
    res.json(profile);
  } catch (err: any) {
    console.error('Error syncing profile to database:', err);
    res.status(500).json({ error: 'Failed to sync profile' });
  }
});

// Server endpoints - backed by Cloud SQL servers & server_members tables
app.get('/api/servers', async (req, res) => {
  const userId = (req.query.userId || req.query.user_id) as string;
  try {
    const userServers = await dbQueries.getServersForUser(userId);
    res.json(userServers);
  } catch (err: any) {
    console.error('Error fetching servers:', err);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

app.post('/api/servers', async (req, res) => {
  const { name, description, owner_id } = req.body;
  if (!name || !owner_id) {
    return res.status(400).json({ error: 'Name and owner_id required' });
  }

  const randomCode = 'WAVE-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const serverId = 'srv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

  try {
    const newServer = await dbQueries.createServer(
      serverId,
      name.trim().toUpperCase(),
      description?.trim() || '',
      owner_id,
      randomCode
    );
    const channels = await dbQueries.getServerChannels(newServer.id, owner_id);
    res.status(201).json({
      server: newServer,
      channels,
    });
  } catch (err: any) {
    console.error('Error creating server in Cloud SQL:', err);
    res.status(500).json({ error: 'Failed to create server' });
  }
});

app.get('/api/servers/:id', async (req, res) => {
  const { id } = req.params;
  const userId = (req.query.userId || req.query.user_id) as string;
  try {
    const server = await dbQueries.getServerById(id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }
    const members = await dbQueries.getServerMembers(id);
    const channels = await dbQueries.getServerChannels(id, userId);
    res.json({
      server,
      members,
      channels,
    });
  } catch (err: any) {
    console.error('Error fetching server details:', err);
    res.status(500).json({ error: 'Failed to fetch server details' });
  }
});

// Dedicated endpoint to fetch channels for a server
app.get('/api/servers/:id/channels', async (req, res) => {
  const { id } = req.params;
  const userId = (req.query.userId || req.query.user_id) as string;
  try {
    const server = await dbQueries.getServerById(id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }
    const accessibleChannels = await dbQueries.getServerChannels(id, userId);
    res.json(accessibleChannels);
  } catch (err: any) {
    console.error('Error fetching channels:', err);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// Dedicated endpoint to fetch members for a server
app.get('/api/servers/:id/members', async (req, res) => {
  const { id } = req.params;
  try {
    const server = await dbQueries.getServerById(id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }
    const members = await dbQueries.getServerMembers(id);
    res.json(members);
  } catch (err: any) {
    console.error('Error fetching members:', err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

app.patch('/api/servers/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, user_id } = req.body;
  try {
    const members = await dbQueries.getServerMembers(id);
    const member = members.find((m) => m.user_id === user_id);
    if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updated = await dbQueries.updateServer(id, name?.trim()?.toUpperCase(), description?.trim());
    if (!updated) return res.status(404).json({ error: 'Server not found' });
    res.json(updated);
  } catch (err: any) {
    console.error('Error updating server:', err);
    res.status(500).json({ error: 'Failed to update server' });
  }
});

app.delete('/api/servers/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  try {
    const server = await dbQueries.getServerById(id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    if (server.owner_id !== user_id) {
      return res.status(403).json({ error: 'Only server owner can delete this server' });
    }

    await dbQueries.deleteServer(id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting server:', err);
    res.status(500).json({ error: 'Failed to delete server' });
  }
});

// Join server via invite code
app.post('/api/servers/join', async (req, res) => {
  const { invite_code, user_id } = req.body;
  if (!invite_code || !user_id) {
    return res.status(400).json({ error: 'Invite code and user_id required' });
  }

  try {
    const result = await dbQueries.joinServerByInviteCode(invite_code.trim().toUpperCase(), user_id);
    res.json({ success: true, server: result.server });
  } catch (err: any) {
    if (err.message === 'Invalid invite code') {
      return res.status(404).json({ error: 'SERVER NOT FOUND: Invalid or expired invite code' });
    }
    console.error('Error joining server:', err);
    res.status(500).json({ error: 'Failed to join server' });
  }
});

// Leave server
app.post('/api/servers/:id/leave', async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  try {
    const server = await dbQueries.getServerById(id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    if (server.owner_id === user_id) {
      return res.status(400).json({ error: 'Owner cannot leave their own server. Delete it or transfer ownership.' });
    }

    await dbQueries.removeServerMember(id, user_id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error leaving server:', err);
    res.status(500).json({ error: 'Failed to leave server' });
  }
});

// Channel creation
app.post('/api/servers/:id/channels', async (req, res) => {
  const { id } = req.params;
  const { name, type, user_id } = req.body;

  if (!name) return res.status(400).json({ error: 'Channel name required' });

  try {
    const members = await dbQueries.getServerMembers(id);
    const member = members.find((m) => m.user_id === user_id);
    if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'Unauthorized to create channels' });
    }

    const cleanName = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const newChanId = 'chn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const newChannel = await dbQueries.createChannel(
      newChanId,
      id,
      cleanName,
      type === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
      user_id
    );

    res.status(201).json(newChannel);
  } catch (err: any) {
    console.error('Error creating channel:', err);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// Delete channel
app.delete('/api/channels/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await dbQueries.deleteChannel(id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting channel:', err);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

// Kick member from server or self-leave
app.delete('/api/servers/:id/members/:targetUserId', async (req, res) => {
  const { id, targetUserId } = req.params;
  const { user_id } = req.body;

  try {
    const server = await dbQueries.getServerById(id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const isSelf = targetUserId === user_id;
    const members = await dbQueries.getServerMembers(id);
    const operator = members.find((m) => m.user_id === user_id);

    if (!isSelf) {
      if (!operator || (operator.role !== 'OWNER' && operator.role !== 'ADMIN')) {
        return res.status(403).json({ error: 'Unauthorized to remove members' });
      }
    }

    if (targetUserId === server.owner_id) {
      return res.status(400).json({ error: 'Cannot remove server owner' });
    }

    await dbQueries.removeServerMember(id, targetUserId);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error removing member:', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Change member role
app.patch('/api/servers/:id/members/:targetUserId/role', async (req, res) => {
  const { id, targetUserId } = req.params;
  const { user_id, role } = req.body;

  try {
    const server = await dbQueries.getServerById(id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    if (server.owner_id !== user_id) {
      return res.status(403).json({ error: 'Only owner can change member roles' });
    }

    if (role === 'ADMIN' || role === 'MEMBER') {
      const updated = await dbQueries.updateServerMemberRole(id, targetUserId, role);
      return res.json(updated);
    }

    res.status(400).json({ error: 'Invalid role' });
  } catch (err: any) {
    console.error('Error updating member role:', err);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// Catch-all for undefined /api routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
});

export default app;
