import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import * as dbQueries from './src/db/queries.ts';

const app = express();
const PORT = 3000;
const server = http.createServer(app);

app.use(express.json());

// --- REST API ROUTES ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'WAVE Walkie-Talkie Backend (Cloud SQL / PostgreSQL Enabled)',
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

// Catch-all for undefined /api routes so they return clean JSON 404 instead of falling through to Vite HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
});

// --- WEBSOCKET SERVER-AUTHORITATIVE SIGNALING & PTT LOCK ---
const wss = new WebSocketServer({ noServer: true });

// channelId -> Map<userId, { socket: WebSocket, user: any, connectedAt: string }>
const activeChannelUsers = new Map<string, Map<string, { socket: WebSocket; user: any; connectedAt: string }>>();

// channelId -> { userId: string, username: string, grantedAt: number }
const activeSpeakerLocks = new Map<string, { userId: string; username: string; grantedAt: number }>();

function broadcastToChannel(channelId: string, message: any, excludeUserId?: string) {
  const usersMap = activeChannelUsers.get(channelId);
  if (!usersMap) return;

  const raw = JSON.stringify(message);
  usersMap.forEach((entry, uid) => {
    if (uid !== excludeUserId && entry.socket.readyState === WebSocket.OPEN) {
      try {
        entry.socket.send(raw);
      } catch (e) {
        console.error('[WAVE WS] Broadcast error to', uid, e);
      }
    }
  });
}

function broadcastChannelPresence(channelId: string) {
  const usersMap = activeChannelUsers.get(channelId);
  if (!usersMap) return;

  const currentLock = activeSpeakerLocks.get(channelId);
  const usersList = Array.from(usersMap.values()).map(({ user, connectedAt }) => ({
    user_id: user.id,
    username: user.username,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    is_transmitting: currentLock ? currentLock.userId === user.id : false,
    connected_at: connectedAt,
  }));

  const payload = {
    type: 'channel_users',
    channel_id: channelId,
    payload: {
      users: usersList,
      active_speaker: currentLock ? { userId: currentLock.userId, username: currentLock.username } : null,
    },
  };

  broadcastToChannel(channelId, payload);
}

wss.on('connection', (ws: WebSocket) => {
  let joinedChannelId: string | null = null;
  let joinedUserId: string | null = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const { type, channel_id, from_user_id, to_user_id, payload } = msg;

      switch (type) {
        case 'join_channel': {
          joinedChannelId = channel_id;
          joinedUserId = from_user_id;

          if (!activeChannelUsers.has(channel_id)) {
            activeChannelUsers.set(channel_id, new Map());
          }

          const channelMap = activeChannelUsers.get(channel_id)!;
          channelMap.set(from_user_id, {
            socket: ws,
            user: payload.user,
            connectedAt: new Date().toISOString(),
          });

          // Broadcast updated user presence to everyone in this channel
          broadcastChannelPresence(channel_id);
          break;
        }

        case 'leave_channel': {
          cleanupUser();
          break;
        }

        // --- ATOMIC ONE-SPEAKER PTT LOCK ---
        case 'request_speaker_lock': {
          if (!channel_id || !from_user_id) return;
          const currentLock = activeSpeakerLocks.get(channel_id);
          const channelMap = activeChannelUsers.get(channel_id);
          const requestingUserEntry = channelMap?.get(from_user_id);

          // Lock safety: expire after 60s of continuous hold
          const isStale = currentLock && Date.now() - currentLock.grantedAt > 60000;

          if (!currentLock || currentLock.userId === from_user_id || isStale) {
            // Grant lock atomically
            const username = requestingUserEntry?.user?.display_name || requestingUserEntry?.user?.username || 'Operator';
            activeSpeakerLocks.set(channel_id, {
              userId: from_user_id,
              username,
              grantedAt: Date.now(),
            });

            // Confirm grant to requester
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'speaker_lock_granted',
                  channel_id,
                })
              );
            }

            // Notify everyone in the channel that this user is transmitting
            broadcastToChannel(channel_id, {
              type: 'speaker_active',
              channel_id,
              payload: {
                speaker: { userId: from_user_id, username },
              },
            });
            broadcastChannelPresence(channel_id);
          } else {
            // Reject: channel busy!
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'speaker_lock_rejected',
                  channel_id,
                  payload: {
                    reason: 'CHANNEL_BUSY',
                    active_speaker: { userId: currentLock.userId, username: currentLock.username },
                  },
                })
              );
            }
          }
          break;
        }

        case 'release_speaker_lock': {
          if (!channel_id || !from_user_id) return;
          const currentLock = activeSpeakerLocks.get(channel_id);
          if (currentLock && currentLock.userId === from_user_id) {
            activeSpeakerLocks.delete(channel_id);

            broadcastToChannel(channel_id, {
              type: 'speaker_lock_released',
              channel_id,
            });
            broadcastChannelPresence(channel_id);
          }
          break;
        }

        // --- WEBRTC SIGNALING RELAY ---
        case 'webrtc_offer':
        case 'webrtc_answer':
        case 'webrtc_ice_candidate': {
          if (!channel_id) return;
          const channelMap = activeChannelUsers.get(channel_id);
          if (!channelMap) return;

          if (to_user_id) {
            // Direct to target user socket
            const target = channelMap.get(to_user_id);
            if (target && target.socket.readyState === WebSocket.OPEN) {
              target.socket.send(JSON.stringify(msg));
            }
          } else {
            // Broadcast to other peers in channel
            broadcastToChannel(channel_id, msg, from_user_id);
          }
          break;
        }

        default:
          break;
      }
    } catch (e) {
      console.error('[WAVE WS] Error processing message:', e);
    }
  });

  const cleanupUser = () => {
    if (joinedChannelId && joinedUserId) {
      const channelMap = activeChannelUsers.get(joinedChannelId);
      if (channelMap) {
        channelMap.delete(joinedUserId);
        if (channelMap.size === 0) {
          activeChannelUsers.delete(joinedChannelId);
        }
      }

      // If user had speaking lock, release it immediately
      const currentLock = activeSpeakerLocks.get(joinedChannelId);
      if (currentLock && currentLock.userId === joinedUserId) {
        activeSpeakerLocks.delete(joinedChannelId);
        broadcastToChannel(joinedChannelId, {
          type: 'speaker_lock_released',
          channel_id: joinedChannelId,
        });
      }

      broadcastChannelPresence(joinedChannelId);
      joinedChannelId = null;
      joinedUserId = null;
    }
  };

  ws.on('close', cleanupUser);
  ws.on('error', cleanupUser);
});

// Upgrade HTTP requests for WebSocket
server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

// Periodic lock check to clear abandoned locks older than 60s
setInterval(() => {
  const now = Date.now();
  activeSpeakerLocks.forEach((lock, channelId) => {
    if (now - lock.grantedAt > 60000) {
      activeSpeakerLocks.delete(channelId);
      broadcastToChannel(channelId, {
        type: 'speaker_lock_released',
        channel_id: channelId,
      });
      broadcastChannelPresence(channelId);
    }
  });
}, 5000);

// --- VITE & STATIC SERVING ---
async function startServer() {
  // Seed initial data in Cloud SQL database if tables are empty
  try {
    await dbQueries.seedInitialDataIfEmpty();
  } catch (seedErr) {
    console.warn('[WAVE Cloud SQL] Initial data seed notice:', seedErr);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[WAVE] Walkie-Talkie Radio Server running on port ${PORT}`);
  });
}

startServer();
