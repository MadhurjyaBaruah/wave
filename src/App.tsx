import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Profile, 
  Server, 
  Channel, 
  ServerMember, 
  ChannelPresenceUser, 
  ServerRole 
} from './types/database';
import { LandingPage } from './components/landing/LandingPage';
import { ServerRail } from './components/dashboard/ServerRail';
import { ChannelSidebar } from './components/dashboard/ChannelSidebar';
import { VoiceConsole } from './components/voice/VoiceConsole';
import { AuthModal } from './components/auth/AuthModal';
import { CreateServerModal } from './components/modals/CreateServerModal';
import { JoinServerModal } from './components/modals/JoinServerModal';
import { CreateChannelModal } from './components/modals/CreateChannelModal';
import { ServerSettingsModal } from './components/modals/ServerSettingsModal';
import { ProfileModal } from './components/modals/ProfileModal';
import { InviteModal } from './components/modals/InviteModal';

import { VoiceManager } from './lib/webrtc/voiceManager';
import { SignalingClient } from './lib/realtime/signalingClient';
import { soundEffects } from './lib/audio/soundEffects';

export default function App() {
  // Navigation & View State
  const [view, setView] = useState<'landing' | 'dashboard'>('landing');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // User State
  const [currentUser, setCurrentUser] = useState<Profile>(() => {
    const saved = localStorage.getItem('wave_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    // Default guest operator callsign
    const defaultOperator: Profile = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      username: 'op_' + Math.floor(100 + Math.random() * 900),
      display_name: 'Radio Operator',
      created_at: new Date().toISOString(),
    };
    localStorage.setItem('wave_user', JSON.stringify(defaultOperator));
    return defaultOperator;
  });

  // Server & Channel State
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServer, setActiveServer] = useState<Server | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [presenceUsers, setPresenceUsers] = useState<ChannelPresenceUser[]>([]);

  // Voice & Lock State
  const [isSignalingConnected, setIsSignalingConnected] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<{ userId: string; username: string } | null>(null);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMicBlocked, setIsMicBlocked] = useState(false);

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);
  const [isJoinServerOpen, setIsJoinServerOpen] = useState(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  // Refs for WebRTC and Signaling Singletons
  const voiceManagerRef = useRef<VoiceManager | null>(null);
  const signalingClientRef = useRef<SignalingClient | null>(null);

  // Sync profile with server on startup
  useEffect(() => {
    if (currentUser?.id) {
      fetch('/api/profiles/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentUser),
      }).catch(() => {});
    }
  }, [currentUser]);

  // Check URL query parameters for invites (?invite=WAVE-XXXXXX)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const invite = params.get('invite');
      if (invite) {
        setIsJoinServerOpen(true);
      }
    }
  }, []);

  // Fetch servers for current user
  const fetchServers = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`/api/servers?user_id=${currentUser.id}`);
      if (res.ok) {
        const data: Server[] = await res.json();
        setServers(data);

        // If no active server yet or current active server is not in list
        if (data.length > 0 && (!activeServer || !data.find((s) => s.id === activeServer.id))) {
          setActiveServer(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load servers:', err);
    }
  }, [currentUser?.id, activeServer]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  // Fetch channels & members when active server changes
  useEffect(() => {
    if (!activeServer || !currentUser?.id) return;

    let isMounted = true;

    const loadServerDetails = async () => {
      try {
        // Fetch channels accessible to current user
        const chRes = await fetch(`/api/servers/${activeServer.id}/channels?user_id=${currentUser.id}`);
        if (chRes.ok && isMounted) {
          const chData: Channel[] = await chRes.json();
          setChannels(chData);

          // Select first channel or keep existing if still available
          if (chData.length > 0) {
            const stillExists = chData.find((c) => c.id === activeChannel?.id);
            setActiveChannel(stillExists || chData[0]);
          } else {
            setActiveChannel(null);
          }
        }

        // Fetch server members
        const memRes = await fetch(`/api/servers/${activeServer.id}/members`);
        if (memRes.ok && isMounted) {
          const memData: ServerMember[] = await memRes.json();
          setMembers(memData);
        }
      } catch (err) {
        console.error('Error loading server details:', err);
      }
    };

    loadServerDetails();

    return () => {
      isMounted = false;
    };
  }, [activeServer?.id, currentUser?.id]);

  // Initialize VoiceManager once
  useEffect(() => {
    const vm = new VoiceManager({
      onAudioLevel: (lvl) => setAudioLevel(lvl),
      onMicError: (err) => {
        console.warn('VoiceManager mic error:', err?.message || err);
        setIsMicBlocked(true);
      },
      onError: (err) => {
        console.warn('VoiceManager error:', err?.message || err);
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || String(err).includes('Permission')) {
          setIsMicBlocked(true);
        }
      },
    });

    voiceManagerRef.current = vm;

    return () => {
      vm.cleanup();
    };
  }, []);

  // Initialize and connect SignalingClient when channel or user changes
  useEffect(() => {
    if (!activeChannel || !currentUser) return;

    const sc = new SignalingClient({
      onConnectionChange: (connected) => {
        setIsSignalingConnected(connected);
      },
      onUsersUpdate: (users) => {
        setPresenceUsers(users);
      },
      onSpeakerLockGranted: () => {
        setActiveSpeaker({ userId: currentUser.id, username: currentUser.username });
        soundEffects.playPttStart();
      },
      onSpeakerLockRejected: () => {
        soundEffects.playBusyError();
      },
      onSpeakerLockReleased: () => {
        setActiveSpeaker(null);
        setIsTransmitting(false);
        if (voiceManagerRef.current) {
          voiceManagerRef.current.stopTransmitting();
        }
        soundEffects.playPttRelease();
      },
      onSpeakerActive: (speaker) => {
        setActiveSpeaker(speaker);
      },
      onSignalMessage: async (msg) => {
        if (!voiceManagerRef.current || !msg.from_user_id) return;
        const vm = voiceManagerRef.current;
        if (msg.type === 'webrtc_offer') {
          const answer = await vm.handleOffer(msg.from_user_id, msg.payload, (cand) => {
            sc.sendSignal({
              type: 'webrtc_ice_candidate',
              to_user_id: msg.from_user_id,
              payload: cand,
            });
          });
          sc.sendSignal({
            type: 'webrtc_answer',
            to_user_id: msg.from_user_id,
            payload: answer,
          });
        } else if (msg.type === 'webrtc_answer') {
          await vm.handleAnswer(msg.from_user_id, msg.payload);
        } else if (msg.type === 'webrtc_ice_candidate') {
          await vm.handleCandidate(msg.from_user_id, msg.payload);
        }
      },
    });

    signalingClientRef.current = sc;
    sc.connect(activeChannel.id, currentUser);
    soundEffects.playChannelJoin();

    return () => {
      sc.disconnect();
      signalingClientRef.current = null;
    };
  }, [activeChannel?.id, currentUser]);

  // PTT Lock Handlers
  const handleRequestLock = useCallback(async (): Promise<boolean> => {
    const sc = signalingClientRef.current;
    const vm = voiceManagerRef.current;
    if (!sc || !vm || !activeChannel) return false;

    try {
      const lockGranted = await sc.requestSpeakerLock();
      if (lockGranted) {
        const transmitStarted = await vm.startTransmitting();
        if (transmitStarted) {
          setIsTransmitting(true);
          setIsMicBlocked(false);
          return true;
        } else {
          // Microphone was denied, dismissed, or unavailable
          setIsTransmitting(false);
          setIsMicBlocked(true);
          sc.releaseSpeakerLock();
          return false;
        }
      }
      return false;
    } catch (err: any) {
      console.warn('PTT Lock request failed:', err?.message || err);
      setIsMicBlocked(true);
      setIsTransmitting(false);
      sc.releaseSpeakerLock();
      return false;
    }
  }, [activeChannel]);

  const handleReleaseLock = useCallback(() => {
    const sc = signalingClientRef.current;
    const vm = voiceManagerRef.current;

    setIsTransmitting(false);
    if (vm) {
      vm.stopTransmitting();
    }
    if (sc) {
      sc.releaseSpeakerLock();
    }
  }, []);

  // Retry microphone access
  const handleRetryMic = async () => {
    if (!voiceManagerRef.current) return;
    try {
      const success = await voiceManagerRef.current.initMicrophone();
      if (success) {
        setIsMicBlocked(false);
      } else {
        setIsMicBlocked(true);
      }
    } catch {
      setIsMicBlocked(true);
    }
  };

  // Enable simulated walkie-talkie tone carrier when microphone is blocked/denied
  const handleEnableSimulatedMic = () => {
    if (!voiceManagerRef.current) return;
    voiceManagerRef.current.enableSimulatedMic();
    setIsMicBlocked(false);
  };

  // Determine current user's role in active server
  const currentMember = members.find((m) => m.user_id === currentUser.id);
  const currentUserRole: ServerRole = currentMember?.role || 'MEMBER';
  const isOwner = currentUserRole === 'OWNER';
  const isAdmin = currentUserRole === 'ADMIN';

  return (
    <div className="flex flex-col h-screen w-screen bg-[#F5F2E8] text-[#0A0A0A] font-mono overflow-hidden">
      {view === 'landing' ? (
        <div className="w-full h-full overflow-y-auto">
          <LandingPage
            onOpenCreateServer={() => {
              setIsCreateServerOpen(true);
            }}
            onOpenJoinServer={() => {
              setIsJoinServerOpen(true);
            }}
            onEnterDashboard={() => {
              setView('dashboard');
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col w-full h-full overflow-hidden">
          {/* Geometric Balance Top Header */}
          <header className="h-16 border-b-4 border-[#0A0A0A] bg-[#FFFFFF] flex items-center justify-between px-6 shrink-0 z-20">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setView('landing')}
                className="bg-[#0A0A0A] text-[#39FF14] px-3 py-1 text-xl sm:text-2xl font-pixel font-bold tracking-tighter cursor-pointer hover:bg-[#1f1f1f] active:translate-y-0.5 border-2 border-[#0A0A0A]"
                title="WAVE Home"
              >
                WAVE // 104.7
              </button>
              <div className="hidden sm:flex gap-1 h-4 items-end">
                <div className="w-1 h-2 bg-[#0A0A0A]"></div>
                <div className="w-1 h-3 bg-[#0A0A0A]"></div>
                <div className="w-1 h-4 bg-[#0A0A0A]"></div>
                <div className="w-1 h-1 bg-[#0A0A0A] opacity-30"></div>
                <div className="w-1 h-2 bg-[#0A0A0A] opacity-30"></div>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 border border-[#0A0A0A] shadow-[1px_1px_0px_#0A0A0A] ${
                    isSignalingConnected ? 'bg-[#39FF14]' : 'bg-[#FFD400]'
                  }`}
                />
                <span className="text-xs font-bold uppercase tracking-widest truncate max-w-[160px] sm:max-w-none text-[#0A0A0A]">
                  CONNECTED // {currentUser.username.toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => setIsProfileOpen(true)}
                className="h-8 w-8 bg-[#FFD400] border-2 border-[#0A0A0A] flex items-center justify-center font-bold text-xs shadow-[2px_2px_0px_#0A0A0A] cursor-pointer hover:bg-[#ffe033] active:translate-y-0.5"
                title="Operator Profile"
              >
                ?
              </button>
            </div>
          </header>

          <main className="flex flex-1 overflow-hidden relative">
            {/* Vertical Server Rail */}
            <ServerRail
              servers={servers}
              activeServerId={activeServer?.id || null}
              currentUser={currentUser}
              onSelectServer={(s) => {
                setActiveServer(s);
                setIsMobileSidebarOpen(false);
              }}
              onOpenCreateServer={() => setIsCreateServerOpen(true)}
              onOpenJoinServer={() => setIsJoinServerOpen(true)}
              onOpenProfile={() => setIsProfileOpen(true)}
              onReturnHome={() => setView('landing')}
            />

            {/* Channel Sidebar */}
            {activeServer ? (
              <ChannelSidebar
                server={activeServer}
                channels={channels}
                activeChannelId={activeChannel?.id || null}
                userRole={currentUserRole}
                onSelectChannel={(ch) => {
                  setActiveChannel(ch);
                  setIsMobileSidebarOpen(false);
                }}
                onOpenCreateChannel={() => setIsCreateChannelOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenInvite={() => setIsInviteOpen(true)}
                onLeaveServer={async () => {
                  try {
                    await fetch(`/api/servers/${activeServer.id}/members/${currentUser.id}`, {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ user_id: currentUser.id }),
                    });
                    fetchServers();
                  } catch {}
                }}
                className={`${
                  isMobileSidebarOpen
                    ? 'absolute inset-y-0 left-[72px] z-40 flex'
                    : 'hidden md:flex'
                }`}
              />
            ) : (
              <div className="hidden md:flex w-64 border-r-4 border-[#0A0A0A] bg-[#FFFFFF] p-5 flex-col justify-between">
                <div className="text-xs text-[#0A0A0A]/70 font-bold uppercase">
                  No active server selected. Create or join a server to transmit.
                </div>
                <button
                  onClick={() => setIsCreateServerOpen(true)}
                  className="retro-btn retro-btn-green py-2 text-xs font-black"
                >
                  + CREATE A SERVER
                </button>
              </div>
            )}

            {/* Voice Console Area */}
            {activeServer && activeChannel ? (
              <VoiceConsole
                server={activeServer}
                channel={activeChannel}
                presenceUsers={presenceUsers}
                activeSpeaker={activeSpeaker}
                isTransmitting={isTransmitting}
                audioLevel={audioLevel}
                isConnected={isSignalingConnected}
                isMicBlocked={isMicBlocked}
                onRetryMic={handleRetryMic}
                onEnableSimulatedMic={handleEnableSimulatedMic}
                onRequestLock={handleRequestLock}
                onReleaseLock={handleReleaseLock}
                onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 font-mono bg-[#FFFFFF]">
                <div className="p-6 bg-[#F5F2E8] border-4 border-[#0A0A0A] shadow-[6px_6px_0px_#0A0A0A] max-w-md space-y-4">
                  <div className="font-pixel text-xl font-black text-[#0A0A0A] uppercase">
                    NO CHANNEL SELECTED
                  </div>
                  <div className="h-1 w-16 bg-[#0A0A0A] mx-auto" />
                  <p className="text-xs font-bold text-[#0A0A0A]/70 leading-relaxed">
                    Select a frequency from the sidebar or initialize a new server to start communicating.
                  </p>
                  <div className="flex justify-center gap-3 pt-2">
                    <button
                      onClick={() => setIsCreateServerOpen(true)}
                      className="retro-btn retro-btn-green px-4 py-2 text-xs font-black"
                    >
                      CREATE SERVER
                    </button>
                    <button
                      onClick={() => setIsJoinServerOpen(true)}
                      className="retro-btn px-4 py-2 text-xs font-black"
                    >
                      JOIN SERVER
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthenticated={(p) => {
          setCurrentUser(p);
          fetchServers();
        }}
      />

      <CreateServerModal
        isOpen={isCreateServerOpen}
        onClose={() => setIsCreateServerOpen(false)}
        userId={currentUser.id}
        onServerCreated={(newServer, newChannels) => {
          setServers((prev) => [newServer, ...prev]);
          setActiveServer(newServer);
          setChannels(newChannels);
          if (newChannels.length > 0) setActiveChannel(newChannels[0]);
          setView('dashboard');
        }}
      />

      <JoinServerModal
        isOpen={isJoinServerOpen}
        onClose={() => setIsJoinServerOpen(false)}
        userId={currentUser.id}
        onServerJoined={(joinedServer) => {
          setServers((prev) => {
            if (prev.find((s) => s.id === joinedServer.id)) return prev;
            return [...prev, joinedServer];
          });
          setActiveServer(joinedServer);
          setView('dashboard');
        }}
      />

      {activeServer && (
        <CreateChannelModal
          isOpen={isCreateChannelOpen}
          onClose={() => setIsCreateChannelOpen(false)}
          serverId={activeServer.id}
          userId={currentUser.id}
          members={members}
          onChannelCreated={(newChannel) => {
            setChannels((prev) => [...prev, newChannel]);
            setActiveChannel(newChannel);
          }}
        />
      )}

      {activeServer && (
        <ServerSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          server={activeServer}
          channels={channels}
          members={members}
          currentUserId={currentUser.id}
          isOwner={isOwner}
          isAdmin={isAdmin}
          onServerUpdated={(updated) => {
            setActiveServer(updated);
            setServers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
          }}
          onServerDeleted={(deletedId) => {
            setServers((prev) => prev.filter((s) => s.id !== deletedId));
            setActiveServer(null);
            setActiveChannel(null);
          }}
          onChannelDeleted={(deletedId) => {
            setChannels((prev) => prev.filter((c) => c.id !== deletedId));
            if (activeChannel?.id === deletedId) {
              const remaining = channels.filter((c) => c.id !== deletedId);
              setActiveChannel(remaining.length > 0 ? remaining[0] : null);
            }
          }}
          onMemberKicked={(kickedId) => {
            setMembers((prev) => prev.filter((m) => m.user_id !== kickedId));
          }}
        />
      )}

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        profile={currentUser}
        onProfileUpdated={(updated) => setCurrentUser(updated)}
        onLogout={() => {
          setIsProfileOpen(false);
          setIsAuthOpen(true);
        }}
      />

      {activeServer && (
        <InviteModal
          isOpen={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
          server={activeServer}
        />
      )}
    </div>
  );
}
