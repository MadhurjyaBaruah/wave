import { ChannelPresenceUser, SignalingMessage } from '../../types/database';
import { supabase, isSupabaseConfigured } from '../supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface SignalingClientCallbacks {
  onConnectionChange?: (connected: boolean) => void;
  onUsersUpdate?: (users: ChannelPresenceUser[]) => void;
  onSpeakerLockGranted?: () => void;
  onSpeakerLockRejected?: (reason: string, activeSpeaker?: string) => void;
  onSpeakerLockReleased?: () => void;
  onSpeakerActive?: (speaker: { userId: string; username: string } | null) => void;
  onSignalMessage?: (msg: SignalingMessage) => void;
}

export class SignalingClient {
  private socket: WebSocket | null = null;
  private supabaseChannel: RealtimeChannel | null = null;
  private channelId: string | null = null;
  private currentUser: { id: string; username: string; display_name: string; avatar_url?: string } | null = null;
  private callbacks: SignalingClientCallbacks = {};
  private reconnectTimer: any = null;
  private isIntentionallyClosed: boolean = false;
  private reconnectAttempts: number = 0;
  private activeSpeakerLock: { userId: string; username: string; grantedAt: number } | null = null;
  private isConnected: boolean = false;

  constructor(callbacks?: SignalingClientCallbacks) {
    if (callbacks) this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: SignalingClientCallbacks) {
    this.callbacks = callbacks;
  }

  public connect(
    channelId: string,
    user: { id: string; username: string; display_name: string; avatar_url?: string }
  ) {
    this.channelId = channelId;
    this.currentUser = user;
    this.isIntentionallyClosed = false;
    this.activeSpeakerLock = null;

    this.disconnect(false);

    // Mode 1: Supabase Realtime (ideal for Vercel serverless deployments without a continuous WS host)
    if (isSupabaseConfigured && supabase) {
      this.connectSupabaseRealtime(channelId, user);
      return;
    }

    // Mode 2: External WebSocket (or local dev server)
    this.connectWebSocket(channelId, user);
  }

  private connectSupabaseRealtime(
    channelId: string,
    user: { id: string; username: string; display_name: string; avatar_url?: string }
  ) {
    if (!supabase) return;

    try {
      const roomTopic = `wave_rt_${channelId}`;
      const channel = supabase.channel(roomTopic, {
        config: {
          presence: { key: user.id },
          broadcast: { self: false },
        },
      });

      // Handle WebRTC signaling & PTT broadcast events
      channel.on('broadcast', { event: 'signal' }, ({ payload }: { payload: SignalingMessage }) => {
        if (!payload) return;
        if (!payload.to_user_id || payload.to_user_id === this.currentUser?.id) {
          this.handleIncomingMessage(payload);
        }
      });

      // Handle presence sync for active operators in this tactical channel
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const usersList: ChannelPresenceUser[] = [];
        const seenIds = new Set<string>();

        Object.values(state).forEach((presences: any) => {
          presences.forEach((entry: any) => {
            const u = entry.user || entry;
            if (u?.id && !seenIds.has(u.id)) {
              seenIds.add(u.id);
              usersList.push({
                user_id: u.id,
                username: u.username || 'Operator',
                display_name: u.display_name || u.username || 'Operator',
                avatar_url: u.avatar_url,
                is_transmitting: this.activeSpeakerLock?.userId === u.id,
                connected_at: entry.connected_at || new Date().toISOString(),
              });
            }
          });
        });

        // Always ensure current user is present
        if (!seenIds.has(user.id)) {
          usersList.push({
            user_id: user.id,
            username: user.username,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            is_transmitting: this.activeSpeakerLock?.userId === user.id,
            connected_at: new Date().toISOString(),
          });
        }

        this.callbacks.onUsersUpdate?.(usersList);
      });

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          this.isConnected = true;
          this.callbacks.onConnectionChange?.(true);

          await channel.track({
            user: this.currentUser,
            connected_at: new Date().toISOString(),
          }).catch(() => {});

          this.send({
            type: 'user_joined',
            channel_id: channelId,
            from_user_id: user.id,
            payload: { user },
          });
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn('[WAVE Realtime] Channel status notice:', status);
          this.enableLocalStandby();
        }
      });

      this.supabaseChannel = channel;
    } catch (err) {
      console.warn('[WAVE Realtime] Supabase channel initialization failed, using local standby:', err);
      this.enableLocalStandby();
    }
  }

  private connectWebSocket(
    channelId: string,
    user: { id: string; username: string; display_name: string; avatar_url?: string }
  ) {
    const envSignalingUrl = (import.meta as any).env?.VITE_SIGNALING_SERVER_URL;
    let wsUrl = envSignalingUrl;

    const isLocalhost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    // On Vercel / non-localhost with no dedicated external WS URL, immediately enable standby mode
    if (!wsUrl && !isLocalhost) {
      this.enableLocalStandby();
      return;
    }

    if (!wsUrl) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/ws`;
    }

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.isConnected = true;
        this.callbacks.onConnectionChange?.(true);

        this.send({
          type: 'join_channel',
          channel_id: this.channelId!,
          from_user_id: this.currentUser?.id,
          payload: { user: this.currentUser },
        });
      };

      this.socket.onmessage = (event) => {
        try {
          const msg: SignalingMessage = JSON.parse(event.data);
          this.handleIncomingMessage(msg);
        } catch (e) {
          console.error('[WAVE Signaling] Parse error:', e);
        }
      };

      this.socket.onclose = () => {
        if (!this.isIntentionallyClosed) {
          this.reconnectAttempts++;
          if (this.reconnectAttempts >= 3) {
            // After 3 failed attempts on Vercel or unstable connection, activate standby
            this.enableLocalStandby();
          } else {
            const delay = Math.min(10000, 1000 * Math.pow(1.5, this.reconnectAttempts));
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => {
              if (this.channelId && this.currentUser && !this.isIntentionallyClosed) {
                this.connect(this.channelId, this.currentUser);
              }
            }, delay);
          }
        }
      };

      this.socket.onerror = (err) => {
        console.warn('[WAVE Signaling] WebSocket notice:', err);
        if (!this.isConnected) {
          this.enableLocalStandby();
        }
      };
    } catch (err) {
      console.warn('[WAVE Signaling] WebSocket creation error:', err);
      this.enableLocalStandby();
    }
  }

  private enableLocalStandby() {
    this.isConnected = true;
    this.callbacks.onConnectionChange?.(true);

    if (this.currentUser) {
      this.callbacks.onUsersUpdate?.([
        {
          user_id: this.currentUser.id,
          username: this.currentUser.username,
          display_name: this.currentUser.display_name,
          avatar_url: this.currentUser.avatar_url,
          is_transmitting: Boolean(this.activeSpeakerLock?.userId === this.currentUser.id),
          connected_at: new Date().toISOString(),
        },
      ]);
    }
  }

  private handleIncomingMessage(msg: SignalingMessage) {
    switch (msg.type) {
      case 'channel_users':
        if (this.callbacks.onUsersUpdate && Array.isArray(msg.payload?.users)) {
          this.callbacks.onUsersUpdate(msg.payload.users);
        }
        if (msg.payload?.active_speaker) {
          this.activeSpeakerLock = msg.payload.active_speaker;
          this.callbacks.onSpeakerActive?.(msg.payload.active_speaker);
        }
        break;

      case 'speaker_lock_granted':
        this.callbacks.onSpeakerLockGranted?.();
        break;

      case 'speaker_lock_rejected':
        this.callbacks.onSpeakerLockRejected?.(
          msg.payload?.reason || 'CHANNEL_BUSY',
          msg.payload?.active_speaker?.username
        );
        break;

      case 'speaker_lock_released':
        this.activeSpeakerLock = null;
        this.callbacks.onSpeakerLockReleased?.();
        this.callbacks.onSpeakerActive?.(null);
        break;

      case 'speaker_active':
        this.activeSpeakerLock = msg.payload?.speaker || null;
        this.callbacks.onSpeakerActive?.(msg.payload?.speaker || null);
        break;

      case 'webrtc_offer':
      case 'webrtc_answer':
      case 'webrtc_ice_candidate':
        this.callbacks.onSignalMessage?.(msg);
        break;

      default:
        break;
    }
  }

  public requestSpeakerLock(): boolean {
    if (!this.channelId || !this.currentUser) return false;

    // Check if channel is occupied by another operator (lock safety: auto-expire after 60s)
    if (this.activeSpeakerLock && this.activeSpeakerLock.userId !== this.currentUser.id) {
      const isStale = Date.now() - this.activeSpeakerLock.grantedAt > 60000;
      if (!isStale) {
        this.callbacks.onSpeakerLockRejected?.('CHANNEL_BUSY', this.activeSpeakerLock.username);
        return false;
      }
    }

    // Set local lock
    this.activeSpeakerLock = {
      userId: this.currentUser.id,
      username: this.currentUser.display_name || this.currentUser.username,
      grantedAt: Date.now(),
    };

    // Supabase Realtime broadcast
    if (this.supabaseChannel) {
      this.send({
        type: 'speaker_active',
        channel_id: this.channelId,
        from_user_id: this.currentUser.id,
        payload: {
          speaker: {
            userId: this.currentUser.id,
            username: this.currentUser.display_name || this.currentUser.username,
          },
        },
      });
    }

    // WebSocket broadcast
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.send({
        type: 'request_speaker_lock',
        channel_id: this.channelId,
        from_user_id: this.currentUser.id,
      });
    }

    this.callbacks.onSpeakerLockGranted?.();
    return true;
  }

  public releaseSpeakerLock() {
    if (!this.channelId || !this.currentUser) return;

    if (this.activeSpeakerLock?.userId === this.currentUser.id) {
      this.activeSpeakerLock = null;
    }

    // Supabase Realtime broadcast
    if (this.supabaseChannel) {
      this.send({
        type: 'speaker_lock_released',
        channel_id: this.channelId,
        from_user_id: this.currentUser.id,
      });
    }

    // WebSocket broadcast
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.send({
        type: 'release_speaker_lock',
        channel_id: this.channelId,
        from_user_id: this.currentUser.id,
      });
    }

    this.callbacks.onSpeakerLockReleased?.();
    this.callbacks.onSpeakerActive?.(null);
  }

  public sendSignal(msg: Partial<SignalingMessage>) {
    this.send({
      ...msg,
      channel_id: this.channelId!,
      from_user_id: this.currentUser?.id,
    } as SignalingMessage);
  }

  private send(msg: SignalingMessage) {
    if (this.supabaseChannel) {
      try {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'signal',
          payload: msg,
        });
      } catch (e) {
        console.warn('[WAVE Realtime] Send error:', e);
      }
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(msg));
      } catch (e) {
        console.warn('[WAVE WS] Send error:', e);
      }
    }
  }

  public disconnect(sendLeave: boolean = true) {
    this.isIntentionallyClosed = true;
    clearTimeout(this.reconnectTimer);

    if (this.supabaseChannel) {
      if (sendLeave && this.channelId && this.currentUser) {
        this.send({
          type: 'leave_channel',
          channel_id: this.channelId,
          from_user_id: this.currentUser.id,
        });
      }
      try {
        if (supabase) {
          supabase.removeChannel(this.supabaseChannel);
        }
      } catch {}
      this.supabaseChannel = null;
    }

    if (this.socket) {
      if (sendLeave && this.channelId && this.currentUser) {
        try {
          this.send({
            type: 'leave_channel',
            channel_id: this.channelId,
            from_user_id: this.currentUser.id,
          });
          this.socket.close();
        } catch {}
      }
      this.socket = null;
    }

    this.channelId = null;
    this.isConnected = false;
  }
}
