/**
 * WebRTC Voice Transport Manager for WAVE
 * Handles peer connections, ICE negotiation, audio track transmission during PTT,
 * and remote audio streams.
 */

export interface VoiceManagerCallbacks {
  onAudioLevel?: (level: number) => void;
  onMicError?: (err: Error) => void;
  onError?: (err: any) => void;
  onPeerConnectionState?: (peerId: string, state: RTCPeerConnectionState) => void;
}

export class VoiceManager {
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private callbacks: VoiceManagerCallbacks = {};
  private isTransmitting: boolean = false;
  private isSimulatedMic: boolean = false;
  private simulatedGainNode: GainNode | null = null;

  private iceServers: RTCIceServer[] = [
    {
      urls: [
        (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_STUN_URL) ||
        (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_STUN_URL) ||
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
        'stun:stun.cloudflare.com:3478',
        'stun:stun.services.mozilla.com',
        'stun:stun.sipgate.net:10000',
      ],
    },
  ];

  constructor(callbacks?: VoiceManagerCallbacks) {
    if (callbacks) this.callbacks = callbacks;
    this.configureTurn();
  }

  private configureTurn() {
    const turnUrl =
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_TURN_URL) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TURN_URL);
    const turnUser =
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_TURN_USERNAME) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TURN_USERNAME);
    const turnCred =
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_TURN_CREDENTIAL) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TURN_CREDENTIAL);

    if (turnUrl && turnUser && turnCred) {
      this.iceServers.push({
        urls: turnUrl,
        username: turnUser,
        credential: turnCred,
      });
    }
  }

  public setCallbacks(callbacks: VoiceManagerCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Acquire local microphone only when needed
   */
  public hasMicrophoneAccess(): boolean {
    if (this.isSimulatedMic && this.localStream) return true;
    return Boolean(
      this.localStream &&
      this.localStream.getAudioTracks().some((t) => t.readyState === 'live')
    );
  }

  public async initMicrophone(forcePrompt: boolean = false): Promise<boolean> {
    if (!forcePrompt && this.localStream && !this.isSimulatedMic && this.localStream.getAudioTracks().some((t) => t.readyState === 'live')) {
      return true;
    }

    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is not supported on this browser or environment (requires HTTPS).');
      }

      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume().catch(() => {});
      }

      // If simulated mic was running, stop it and clear
      if (this.isSimulatedMic && this.localStream) {
        this.localStream.getTracks().forEach((track) => track.stop());
        this.localStream = null;
      }
      this.isSimulatedMic = false;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // Default mute until PTT is pressed
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });

      this.isSimulatedMic = false;
      this.localStream = stream;
      this.setupAudioAnalyser(stream);
      return true;
    } catch (err: any) {
      console.warn('[WAVE] Microphone access was not granted:', err?.name || err?.message || err);
      if (this.callbacks.onMicError) {
        this.callbacks.onMicError(err);
      }
      if (this.callbacks.onError) {
        this.callbacks.onError(err);
      }
      return false;
    }
  }

  /**
   * Compatibility alias for App.tsx retry handler
   */
  public async initAudio(): Promise<boolean> {
    return this.initMicrophone();
  }

  /**
   * Activates synthetic walkie-talkie carrier beacon for testing when physical mic is denied/unavailable
   */
  public enableSimulatedMic(): boolean {
    try {
      if (typeof window === 'undefined') return false;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return false;

      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      const dest = this.audioContext.createMediaStreamDestination();

      const bufferSize = this.audioContext.sampleRate * 2;
      const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.15;
      }

      const noiseSource = this.audioContext.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000;
      filter.Q.value = 3.0;

      const carrierGain = this.audioContext.createGain();
      carrierGain.gain.value = 0; // Muted until transmitting

      noiseSource.connect(filter);
      filter.connect(carrierGain);
      carrierGain.connect(dest);

      noiseSource.start(0);

      this.simulatedGainNode = carrierGain;
      this.isSimulatedMic = true;
      this.localStream = dest.stream;
      this.setupAudioAnalyser(dest.stream);

      return true;
    } catch (e) {
      console.warn('[WAVE] Failed to initialize simulated microphone:', e);
      return false;
    }
  }

  public isUsingSimulatedMic(): boolean {
    return this.isSimulatedMic;
  }

  private setupAudioAnalyser(stream: MediaStream) {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AudioCtx();
      }
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkLevel = () => {
        if (!this.isTransmitting) {
          if (this.callbacks.onAudioLevel) this.callbacks.onAudioLevel(0);
          this.animFrameId = requestAnimationFrame(checkLevel);
          return;
        }

        if (this.isSimulatedMic) {
          const simulatedLvl = Math.round(45 + Math.random() * 40);
          if (this.callbacks.onAudioLevel) {
            this.callbacks.onAudioLevel(simulatedLvl);
          }
          this.animFrameId = requestAnimationFrame(checkLevel);
          return;
        }

        if (!this.analyser) {
          this.animFrameId = requestAnimationFrame(checkLevel);
          return;
        }

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));

        if (this.callbacks.onAudioLevel) {
          this.callbacks.onAudioLevel(normalized);
        }

        this.animFrameId = requestAnimationFrame(checkLevel);
      };

      this.animFrameId = requestAnimationFrame(checkLevel);
    } catch (e) {
      console.warn('[WAVE] Analyser setup skipped:', e);
    }
  }

  /**
   * Generates a completely silent MediaStreamTrack for SDP audio pre-negotiation
   */
  public createSilentAudioTrack(): MediaStreamTrack {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
      const dest = this.audioContext.createMediaStreamDestination();
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      gain.gain.setValueAtTime(0, this.audioContext.currentTime);
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      const silentTrack = dest.stream.getAudioTracks()[0];
      silentTrack.enabled = false;
      return silentTrack;
    } catch {
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      return dest.stream.getAudioTracks()[0];
    }
  }

  /**
   * Called when PTT is pressed: enables audio track and swaps into all peer senders
   */
  public async startTransmitting(): Promise<boolean> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume().catch(() => {});
    }

    if (!this.isSimulatedMic) {
      const hasMic = await this.initMicrophone();
      if (!hasMic || !this.localStream) {
        this.enableSimulatedMic();
      }
    } else if (!this.localStream) {
      this.enableSimulatedMic();
    }

    if (!this.localStream) return false;

    this.isTransmitting = true;
    const localTrack = this.localStream.getAudioTracks()[0];
    if (localTrack) {
      localTrack.enabled = true;
    }

    if (this.isSimulatedMic && this.simulatedGainNode && this.audioContext) {
      this.simulatedGainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
    }

    // Seamlessly swap live audio track into pre-negotiated RTP senders (zero SDP renegotiation required)
    if (localTrack) {
      this.peerConnections.forEach((pc) => {
        const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
        const audioTransceiver = transceivers.find(
          (t) => (t.sender && t.sender.track?.kind === 'audio') || t.receiver?.track?.kind === 'audio'
        );
        const senders = pc.getSenders();
        const audioSender =
          audioTransceiver?.sender ||
          senders.find((s) => s.track?.kind === 'audio' || (s as any).kind === 'audio') ||
          senders[0];

        if (audioSender) {
          audioSender.replaceTrack(localTrack).catch((e) => {
            console.warn('[WAVE WebRTC] replaceTrack error:', e);
          });
        }
      });
    }

    return true;
  }

  /**
   * Called when PTT is released: mutes the audio track
   */
  public stopTransmitting() {
    this.isTransmitting = false;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }
    if (this.isSimulatedMic && this.simulatedGainNode && this.audioContext) {
      this.simulatedGainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    }
    if (this.callbacks.onAudioLevel) {
      this.callbacks.onAudioLevel(0);
    }
  }

  public hasPeerConnection(peerId: string): boolean {
    return this.peerConnections.has(peerId);
  }

  public getConnectedPeerIds(): string[] {
    return Array.from(this.peerConnections.keys());
  }

  /**
   * Immediately resumes and plays all remote audio elements when an operator begins transmitting
   */
  public ensureRemoteAudioPlaying() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    this.remoteAudioElements.forEach((audioEl) => {
      if (audioEl) {
        audioEl.muted = false;
        audioEl.volume = 1.0;
        if (audioEl.paused) {
          audioEl.play().catch(() => {});
        }
      }
    });
  }

  /**
   * Create or get RTCPeerConnection for a remote peer with pre-negotiated audio track
   */
  public createPeerConnection(
    peerId: string,
    onIceCandidate: (candidate: RTCIceCandidate) => void
  ): RTCPeerConnection {
    if (this.peerConnections.has(peerId)) {
      return this.peerConnections.get(peerId)!;
    }

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });

    // Pre-negotiate two-way audio transceiver with an active track from the start
    let initialStream = this.localStream;
    let initialTrack = initialStream ? initialStream.getAudioTracks()[0] : null;
    if (!initialTrack) {
      initialTrack = this.createSilentAudioTrack();
      initialStream = new MediaStream([initialTrack]);
    }

    try {
      pc.addTransceiver(initialTrack, {
        direction: 'sendrecv',
        streams: initialStream ? [initialStream] : [],
      });
    } catch {
      try {
        if (initialStream) {
          pc.addTrack(initialTrack, initialStream);
        } else {
          pc.addTrack(initialTrack);
        }
      } catch {}
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WAVE WebRTC] Peer ${peerId} connectionState: ${pc.connectionState}`);
      if (this.callbacks.onPeerConnectionState) {
        this.callbacks.onPeerConnectionState(peerId, pc.connectionState);
      }
      if (pc.connectionState === 'failed') {
        console.warn(`[WAVE WebRTC] Peer ${peerId} connection failed, attempting ICE restart`);
        pc.restartIce?.();
      }
    };

    pc.ontrack = (event) => {
      console.log(`[WAVE WebRTC] Received remote audio track from ${peerId}`);
      const stream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
      this.attachRemoteAudio(peerId, stream);
    };

    this.peerConnections.set(peerId, pc);
    return pc;
  }

  private attachRemoteAudio(peerId: string, stream: MediaStream) {
    if (typeof window === 'undefined') return;
    let audioEl = this.remoteAudioElements.get(peerId);
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.id = `remote-audio-${peerId}`;
      audioEl.autoplay = true;
      (audioEl as any).playsInline = true;
      audioEl.muted = false;
      audioEl.volume = 1.0;
      audioEl.style.position = 'fixed';
      audioEl.style.pointerEvents = 'none';
      audioEl.style.opacity = '0';
      audioEl.style.width = '1px';
      audioEl.style.height = '1px';
      audioEl.style.bottom = '0';
      document.body.appendChild(audioEl);
      this.remoteAudioElements.set(peerId, audioEl);
    }

    audioEl.muted = false;
    audioEl.volume = 1.0;

    if (audioEl.srcObject !== stream) {
      audioEl.srcObject = stream;
    }

    const tryPlay = () => {
      if (audioEl) {
        audioEl.muted = false;
        audioEl.volume = 1.0;
        audioEl.play().catch((err) => {
          console.log('[WAVE WebRTC] Playback waiting for interaction:', err?.message || err);
          const unlock = () => {
            if (audioEl) {
              audioEl.muted = false;
              audioEl.volume = 1.0;
              audioEl.play().catch(() => {});
            }
            window.removeEventListener('click', unlock);
            window.removeEventListener('touchstart', unlock);
            window.removeEventListener('keydown', unlock);
          };
          window.addEventListener('click', unlock, { once: true });
          window.addEventListener('touchstart', unlock, { once: true });
          window.addEventListener('keydown', unlock, { once: true });
        });
      }
    };

    tryPlay();

    // Re-trigger play when tracks unmute (RTP media packets start arriving)
    stream.getAudioTracks().forEach((track) => {
      track.onunmute = () => {
        console.log(`[WAVE WebRTC] Remote track unmuted from ${peerId}`);
        tryPlay();
      };
    });
  }

  public async createOffer(peerId: string, onIceCandidate: (c: RTCIceCandidate) => void): Promise<RTCSessionDescriptionInit> {
    const pc = this.createPeerConnection(peerId, onIceCandidate);
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    await pc.setLocalDescription(offer);
    return offer;
  }

  public async handleOffer(
    peerId: string,
    offer: RTCSessionDescriptionInit,
    onIceCandidate: (c: RTCIceCandidate) => void
  ): Promise<RTCSessionDescriptionInit> {
    const pc = this.createPeerConnection(peerId, onIceCandidate);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    await this.flushPendingCandidates(peerId, pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  }

  public async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peerConnections.get(peerId);
    if (pc && pc.signalingState !== 'stable') {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      await this.flushPendingCandidates(peerId, pc);
    }
  }

  public async handleCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.get(peerId);
    if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
      const list = this.pendingCandidates.get(peerId) || [];
      list.push(candidate);
      this.pendingCandidates.set(peerId, list);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[WAVE WebRTC] Candidate error:', err);
    }
  }

  private async flushPendingCandidates(peerId: string, pc: RTCPeerConnection) {
    const pending = this.pendingCandidates.get(peerId);
    if (pending && pending.length > 0) {
      for (const cand of pending) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('[WAVE WebRTC] Failed to add buffered candidate:', e);
        }
      }
      this.pendingCandidates.delete(peerId);
    }
  }

  public closePeer(peerId: string) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    const audioEl = this.remoteAudioElements.get(peerId);
    if (audioEl) {
      audioEl.srcObject = null;
      if (audioEl.parentNode) {
        audioEl.parentNode.removeChild(audioEl);
      }
      this.remoteAudioElements.delete(peerId);
    }
    this.pendingCandidates.delete(peerId);
  }

  /**
   * Leave channel and release all tracks & connections
   */
  public cleanup() {
    this.stopTransmitting();

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();

    this.remoteAudioElements.forEach((el) => {
      el.srcObject = null;
      el.remove();
    });
    this.remoteAudioElements.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}
