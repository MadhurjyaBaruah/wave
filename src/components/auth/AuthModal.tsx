import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Profile } from '../../types/database';
import { supabase, isSupabaseConfigured } from '../../lib/supabase/client';
import { auth, googleAuthProvider } from '../../lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { Radio, User, Key, Mail, Check, Database } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (profile: Profile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<'quick' | 'login' | 'signup'>('quick');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuickOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim()) {
      setError('Callsign / Username is required');
      return;
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanDisplay = displayName.trim() || cleanUsername.toUpperCase();

    const tempId = 'usr_' + Math.random().toString(36).substring(2, 10);
    const newProfile: Profile = {
      id: tempId,
      username: cleanUsername,
      display_name: cleanDisplay,
      avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`,
      created_at: new Date().toISOString(),
    };

    try {
      await fetch('/api/profiles/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProfile),
      });
    } catch {}

    localStorage.setItem('wave_user', JSON.stringify(newProfile));
    onAuthenticated(newProfile);
    onClose();
  };

  const handleGoogleAuth = async () => {
    if (!auth || !googleAuthProvider) {
      setError('Firebase Authentication not configured');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const user = result.user;
      const token = await user.getIdToken();
      localStorage.setItem('wave_token', token);

      const cleanUsername = (user.email ? user.email.split('@')[0] : 'op_' + user.uid.substring(0, 5))
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');

      const profile: Profile = {
        id: user.uid,
        username: cleanUsername,
        display_name: user.displayName || cleanUsername.toUpperCase(),
        avatar_url: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`,
        created_at: new Date().toISOString(),
      };

      await fetch('/api/profiles/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      });

      localStorage.setItem('wave_user', JSON.stringify(profile));
      onAuthenticated(profile);
      onClose();
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setError(err.message || 'Google Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSupabaseAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase credentials not configured in environment.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.trim().toLowerCase(),
              display_name: displayName.trim() || username.trim(),
            },
          },
        });

        if (signUpError) throw signUpError;
        if (data.user) {
          const profile: Profile = {
            id: data.user.id,
            username: username.trim().toLowerCase() || `op_${data.user.id.substring(0, 5)}`,
            display_name: displayName.trim() || username.trim(),
            created_at: new Date().toISOString(),
          };
          localStorage.setItem('wave_user', JSON.stringify(profile));
          onAuthenticated(profile);
          onClose();
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        if (data.user) {
          const profile: Profile = {
            id: data.user.id,
            username: data.user.user_metadata?.username || `op_${data.user.id.substring(0, 5)}`,
            display_name: data.user.user_metadata?.display_name || 'Operator',
            created_at: new Date().toISOString(),
          };
          localStorage.setItem('wave_user', JSON.stringify(profile));
          onAuthenticated(profile);
          onClose();
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="OPERATOR IDENTIFICATION"
      subtitle="Authenticate or initialize tactical callsign"
    >
      <div className="space-y-4">
        {/* Active Database Status */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#F5F2E8] border-2 border-[#0A0A0A] text-[11px] font-bold">
          <div className="flex items-center gap-1.5 text-[#0A0A0A]">
            <Database size={13} className="text-[#00C853]" />
            <span>CLOUD SQL DATABASE:</span>
          </div>
          <span className="text-[#00C853] font-mono">ONLINE // asia-southeast1</span>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-3 gap-2 border-b-2 border-[#0A0A0A] pb-3 text-xs">
          <button
            type="button"
            onClick={() => setMode('quick')}
            className={`py-2 px-2 border-2 border-[#0A0A0A] font-bold text-xs uppercase cursor-pointer transition-all ${
              mode === 'quick'
                ? 'bg-[#0A0A0A] text-[#FFFFFF] shadow-[2px_2px_0px_#0A0A0A]'
                : 'bg-[#FFFFFF] text-[#0A0A0A] hover:bg-[#F5F2E8]'
            }`}
          >
            QUICK CALLSIGN
          </button>
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`py-2 px-2 border-2 border-[#0A0A0A] font-bold text-xs uppercase cursor-pointer transition-all ${
              mode === 'login'
                ? 'bg-[#0A0A0A] text-[#FFFFFF] shadow-[2px_2px_0px_#0A0A0A]'
                : 'bg-[#FFFFFF] text-[#0A0A0A] hover:bg-[#F5F2E8]'
            }`}
          >
            SUPABASE LOGIN
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`py-2 px-2 border-2 border-[#0A0A0A] font-bold text-xs uppercase cursor-pointer transition-all ${
              mode === 'signup'
                ? 'bg-[#0A0A0A] text-[#FFFFFF] shadow-[2px_2px_0px_#0A0A0A]'
                : 'bg-[#FFFFFF] text-[#0A0A0A] hover:bg-[#F5F2E8]'
            }`}
          >
            SIGN UP
          </button>
        </div>

        {error && (
          <div className="p-3 bg-[#FFE8EC] border-2 border-[#FF304F] text-[#FF304F] text-xs font-bold uppercase shadow-[2px_2px_0px_#0A0A0A]">
            {error}
          </div>
        )}

        {/* Google Authentication Option */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={loading}
          id="auth-google-btn"
          className="w-full bg-[#FFFFFF] hover:bg-[#F5F2E8] text-[#0A0A0A] border-2 border-[#0A0A0A] py-2.5 px-3 text-xs font-black uppercase flex items-center justify-center gap-2 shadow-[3px_3px_0px_#0A0A0A] active:translate-y-0.5 cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>SIGN IN WITH GOOGLE & CLOUD SQL</span>
        </button>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t-2 border-[#0A0A0A]"></div>
          <span className="flex-shrink mx-2 text-[10px] font-black uppercase text-[#0A0A0A] bg-[#FFFFFF] px-2">OR</span>
          <div className="flex-grow border-t-2 border-[#0A0A0A]"></div>
        </div>

        {mode === 'quick' ? (
          <form onSubmit={handleQuickOperator} className="space-y-4">
            <div className="p-3 bg-[#F5F2E8] border-2 border-[#0A0A0A] text-xs text-[#0A0A0A] font-bold">
              <span className="text-[#0A0A0A] font-black uppercase">INSTANT TACTICAL ACCESS:</span> Enter an operator callsign to begin transmitting immediately.
            </div>

            <div className="space-y-1">
              <label className="text-xs uppercase font-bold text-[#0A0A0A] flex items-center gap-1.5">
                <User size={13} />
                <span>Callsign / Handle *</span>
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. viper_01, chief, radar"
                className="w-full bg-[#F5F2E8] border-2 border-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] font-bold font-mono focus:outline-none shadow-[2px_2px_0px_#0A0A0A]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs uppercase font-bold text-[#0A0A0A] flex items-center gap-1.5">
                <Radio size={13} />
                <span>Display Name (Optional)</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Unit 4 // Recon"
                className="w-full bg-[#F5F2E8] border-2 border-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] font-bold font-mono focus:outline-none shadow-[2px_2px_0px_#0A0A0A]"
              />
            </div>

            <button
              type="submit"
              id="auth-quick-start-btn"
              className="w-full retro-btn retro-btn-green py-3 text-sm font-black flex items-center justify-center gap-2 shadow-[4px_4px_0px_#0A0A0A] active:translate-y-1"
            >
              <Check size={16} />
              <span>INITIALIZE CALLSIGN & TRANSMIT</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleSupabaseAuth} className="space-y-4">
            {!isSupabaseConfigured && (
              <div className="p-3 bg-[#FFF9E6] border-2 border-[#FFD400] text-[#0A0A0A] text-xs font-bold shadow-[2px_2px_0px_#0A0A0A]">
                SUPABASE NOT YET DETECTED IN ENVIRONMENT. You can use Google Sign-In or &quot;Quick Callsign&quot; mode with the integrated Cloud SQL database.
              </div>
            )}

            {mode === 'signup' && (
              <div className="space-y-1">
                <label className="text-xs uppercase font-bold text-[#0A0A0A] flex items-center gap-1.5">
                  <User size={13} />
                  <span>Unique Username</span>
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. radio_operator"
                  className="w-full bg-[#F5F2E8] border-2 border-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] font-bold font-mono focus:outline-none shadow-[2px_2px_0px_#0A0A0A]"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs uppercase font-bold text-[#0A0A0A] flex items-center gap-1.5">
                <Mail size={13} />
                <span>Email Address</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@wave-radio.net"
                className="w-full bg-[#F5F2E8] border-2 border-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] font-bold font-mono focus:outline-none shadow-[2px_2px_0px_#0A0A0A]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs uppercase font-bold text-[#0A0A0A] flex items-center gap-1.5">
                <Key size={13} />
                <span>Password</span>
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#F5F2E8] border-2 border-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] font-bold font-mono focus:outline-none shadow-[2px_2px_0px_#0A0A0A]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              id="auth-submit-btn"
              className="w-full retro-btn retro-btn-green py-3 text-sm font-black flex items-center justify-center gap-2 shadow-[4px_4px_0px_#0A0A0A] active:translate-y-1"
            >
              {loading ? (
                <span>AUTHENTICATING...</span>
              ) : mode === 'signup' ? (
                <span>REGISTER WITH SUPABASE</span>
              ) : (
                <span>LOGIN WITH SUPABASE</span>
              )}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
};
