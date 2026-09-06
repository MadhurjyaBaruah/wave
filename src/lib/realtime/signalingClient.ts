import { ChannelPresenceUser, SignalingMessage } from '../../types/database';

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
  private channelId: string | null = null;
  private currentUser: { id: string; username: string; display_name: string; avatar_url?: string } | null = null;
  private callbacks: SignalingClientCallbacks = {};
  private reconnectTimer: any = null;
  private isIntentionallyClosed: boolean = false;

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

    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        if (this.callbacks.onConnectionChange) {
          this.callbacks.onConnectionChange(true);
        }

        // Immediately send join message
        this.send({
          type: 'join_channel',
          channel_id: this.channelId!,
          from_user_id: this.currentUser?.id,
          payload: {
            user: this.currentUser,
          },
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
        if (this.callbacks.onConnectionChange) {
          this.callbacks.onConnectionChange(false);
        }

        if (!this.isIntentionallyClosed) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => {
            if (this.channelId && this.currentUser && !this.isIntentionallyClosed) {
              this.connect(this.channelId, this.currentUser);
            }
          }, 2000);
        }
      };

      this.socket.onerror = (err) => {
        console.warn('[WAVE Signaling] Socket error:', err);
      };
    } catch (err) {
      console.error('[WAVE Signaling] Connection failed:', err);
    }
  }

  private handleIncomingMessage(msg: SignalingMessage) {
    switch (msg.type) {
      case 'channel_users':
        if (this.callbacks.onUsersUpdate && Array.isArray(msg.payload?.users)) {
          this.callbacks.onUsersUpdate(msg.payload.users);
        }
        if (msg.payload?.active_speaker) {
          if (this.callbacks.onSpeakerActive) {
            this.callbacks.onSpeakerActive(msg.payload.active_speaker);
          }
        }
        break;

      case 'speaker_lock_granted':
        if (this.callbacks.onSpeakerLockGranted) {
          this.callbacks.onSpeakerLockGranted();
        }
        break;

      case 'speaker_lock_rejected':
        if (this.callbacks.onSpeakerLockRejected) {
          this.callbacks.onSpeakerLockRejected(
            msg.payload?.reason || 'CHANNEL_BUSY',
            msg.payload?.active_speaker?.username
          );
        }
        break;

      case 'speaker_lock_released':
        if (this.callbacks.onSpeakerLockReleased) {
          this.callbacks.onSpeakerLockReleased();
        }
        if (this.callbacks.onSpeakerActive) {
          this.callbacks.onSpeakerActive(null);
        }
        break;

      case 'speaker_active':
        if (this.callbacks.onSpeakerActive) {
          this.callbacks.onSpeakerActive(msg.payload?.speaker || null);
        }
        break;

      case 'webrtc_offer':
      case 'webrtc_answer':
      case 'webrtc_ice_candidate':
        if (this.callbacks.onSignalMessage) {
          this.callbacks.onSignalMessage(msg);
        }
        break;

      default:
        break;
    }
  }

  public requestSpeakerLock(): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.channelId) {
      return false;
    }
    this.send({
      type: 'request_speaker_lock',
      channel_id: this.channelId,
      from_user_id: this.currentUser?.id,
    });
    return true;
  }

  public releaseSpeakerLock() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.channelId) {
      return;
    }
    this.send({
      type: 'release_speaker_lock',
      channel_id: this.channelId,
      from_user_id: this.currentUser?.id,
    });
  }

  public sendSignal(msg: Partial<SignalingMessage>) {
    this.send({
      ...msg,
      channel_id: this.channelId!,
      from_user_id: this.currentUser?.id,
    } as SignalingMessage);
  }

  private send(msg: SignalingMessage) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    }
  }

  public disconnect() {
    this.isIntentionallyClosed = true;
    clearTimeout(this.reconnectTimer);
    if (this.socket && this.channelId) {
      try {
        this.send({
          type: 'leave_channel',
          channel_id: this.channelId,
          from_user_id: this.currentUser?.id,
        });
        this.socket.close();
      } catch {}
      this.socket = null;
    }
    this.channelId = null;
  }
}
