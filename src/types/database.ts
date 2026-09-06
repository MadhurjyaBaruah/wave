export type ServerRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type ChannelType = 'PUBLIC' | 'PRIVATE';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface Server {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
  updated_at?: string;
}

export interface ServerMember {
  server_id: string;
  user_id: string;
  role: ServerRole;
  created_at: string;
  profile?: Profile;
}

export interface Channel {
  id: string;
  server_id: string;
  name: string;
  type: ChannelType;
  created_at: string;
  updated_at?: string;
}

export interface ChannelMember {
  channel_id: string;
  user_id: string;
  created_at: string;
  profile?: Profile;
}

export interface ChannelPresenceUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  is_transmitting: boolean;
  connected_at: string;
}

export interface SpeakerLock {
  channel_id: string;
  user_id: string;
  username: string;
  granted_at: number;
}

export type SignalingMessageType =
  | 'join_channel'
  | 'leave_channel'
  | 'user_joined'
  | 'user_left'
  | 'channel_users'
  | 'request_speaker_lock'
  | 'release_speaker_lock'
  | 'speaker_lock_granted'
  | 'speaker_lock_rejected'
  | 'speaker_lock_released'
  | 'speaker_active'
  | 'webrtc_offer'
  | 'webrtc_answer'
  | 'webrtc_ice_candidate';

export interface SignalingMessage {
  type: SignalingMessageType;
  channel_id: string;
  from_user_id?: string;
  to_user_id?: string;
  payload?: any;
}
