import http from 'http';
import path from 'path';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import app from './src/server/app.ts';
import * as dbQueries from './src/db/queries.ts';

const PORT = 3000;
const server = http.createServer(app);

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
