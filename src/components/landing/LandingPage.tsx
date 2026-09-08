import React from 'react';
import { WaveLogo } from '../branding/WaveLogo';
import { Radio, Mic, Users, Lock, Shield, Smartphone, ArrowRight, Zap, Volume2 } from 'lucide-react';

interface LandingPageProps {
  onOpenCreateServer: () => void;
  onOpenJoinServer: () => void;
  onEnterDashboard: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenCreateServer,
  onOpenJoinServer,
  onEnterDashboard,
}) => {
  return (
    <div className="min-h-screen bg-[#F5F2E8] text-[#0A0A0A] font-mono selection:bg-[#39FF14] selection:text-black">
      {/* Top Header */}
      <header className="border-b-4 border-[#0A0A0A] bg-[#FFFFFF] sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
        <WaveLogo size="md" showTagline />

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenJoinServer}
            id="landing-header-join-btn"
            className="retro-btn px-4 py-2 text-xs font-bold"
          >
            JOIN SERVER
          </button>
          <button
            onClick={onEnterDashboard}
            id="landing-header-enter-btn"
            className="retro-btn retro-btn-green px-4 py-2 text-xs font-black"
          >
            LAUNCH APP
          </button>
        </div>
      </header>

      {/* Main Hero Container */}
      <section className="max-w-6xl mx-auto px-6 pt-12 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Typography & Call To Actions */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FFFFFF] border-2 border-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] text-[#0A0A0A] text-xs font-bold font-mono">
              <span className="w-2.5 h-2.5 bg-[#39FF14] border border-[#0A0A0A]" />
              <span>COMMUNICATION FREQUENCY // 104.7 MHZ</span>
            </div>

            <div className="space-y-3">
              <h1 className="font-pixel text-5xl sm:text-6xl md:text-7xl font-black tracking-tight text-[#0A0A0A] leading-none">
                WAVE
              </h1>
              <p className="font-pixel text-xl sm:text-2xl text-[#0A0A0A] font-bold tracking-wide">
                YOUR INTERNET WALKIE-TALKIE.
              </p>
            </div>

            <div className="p-5 bg-[#FFFFFF] border-4 border-[#0A0A0A] shadow-[6px_6px_0px_#0A0A0A]">
              <p className="font-mono text-xl text-[#0A0A0A] tracking-widest font-black uppercase">
                Press. <span className="text-[#FF304F]">Talk.</span> Release.
              </p>
              <p className="text-sm text-[#0A0A0A]/80 mt-2 font-bold leading-relaxed">
                Instant, low-latency audio transmission directly inside your browser. No bloated bloatware. One speaker at a time. Pure tactical clarity.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <button
                onClick={onOpenCreateServer}
                id="hero-create-server-btn"
                className="retro-btn retro-btn-green px-6 py-3.5 text-sm md:text-base font-black flex items-center gap-2 shadow-[4px_4px_0px_#0A0A0A] active:translate-y-1"
              >
                <Radio className="w-5 h-5" />
                <span>CREATE A SERVER</span>
              </button>

              <button
                onClick={onOpenJoinServer}
                id="hero-join-server-btn"
                className="retro-btn px-6 py-3.5 text-sm md:text-base font-black flex items-center gap-2 shadow-[4px_4px_0px_#0A0A0A] active:translate-y-1"
              >
                <ArrowRight className="w-5 h-5" />
                <span>JOIN BY INVITE CODE</span>
              </button>
            </div>
          </div>

          {/* Right Column: Physical Walkie-Talkie Visual Mockup */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-sm bg-[#FFFFFF] border-4 border-[#0A0A0A] p-6 shadow-[8px_8px_0px_#0A0A0A] relative">
              {/* Top Antenna */}
              <div className="absolute -top-8 left-8 w-4 h-8 bg-[#0A0A0A] border-2 border-[#0A0A0A] flex items-center justify-center">
                <div className="w-1.5 h-full bg-[#FFFFFF]" />
              </div>
              <div className="absolute -top-4 right-10 flex gap-2">
                <div className="w-6 h-4 bg-[#0A0A0A] border-2 border-[#0A0A0A]" />
                <div className="w-8 h-4 bg-[#FFD400] border-2 border-[#0A0A0A]" />
              </div>

              {/* Radio LCD Screen */}
              <div className="bg-[#0A0A0A] border-2 border-[#0A0A0A] p-3.5 text-[#39FF14] mb-4">
                <div className="flex justify-between text-[10px] border-b border-[#39FF14]/40 pb-1 mb-2 font-bold">
                  <span>FREQ: 142.800 MHz</span>
                  <span className="text-[#39FF14]">● RX/TX READY</span>
                </div>
                <div className="font-pixel text-lg font-bold tracking-wider text-center py-2">
                  CHANNEL 01 // GENERAL
                </div>
                <div className="flex justify-between text-[10px] text-[#FFFFFF]/80 font-bold">
                  <span>4 OPERATORS ONLINE</span>
                  <span className="text-[#39FF14]">LOCK: STANDBY</span>
                </div>
              </div>

              {/* Speaker Grill */}
              <div className="grid grid-cols-6 gap-1 my-4 p-2.5 bg-[#F5F2E8] border-2 border-[#0A0A0A]">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="h-1 bg-[#0A0A0A]" />
                ))}
              </div>

              {/* Interactive Radio Launch Button */}
              <div 
                onClick={onEnterDashboard}
                className="p-4 bg-[#F5F2E8] border-2 border-[#0A0A0A] flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#FFFFFF] transition-all group"
                title="Click to launch live walkie-talkie"
              >
                <div className="w-20 h-20 bg-[#39FF14] rounded-full border-4 border-[#0A0A0A] shadow-[0_4px_0_#0A0A0A] flex flex-col items-center justify-center my-2 group-hover:scale-105 group-active:translate-y-1 transition-transform">
                  <Mic className="w-7 h-7 text-[#0A0A0A]" />
                  <span className="text-[7px] font-black uppercase text-[#0A0A0A] mt-0.5">LAUNCH</span>
                </div>
                <span className="font-pixel text-xs text-[#0A0A0A] font-bold tracking-widest mt-1">
                  ENTER WALKIE-TALKIE
                </span>
                <span className="text-[10px] text-[#0A0A0A]/70 font-bold uppercase font-mono">
                  CLICK TO LAUNCH DISPATCH NET
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="border-t-4 border-[#0A0A0A] bg-[#FFFFFF] py-16 px-6">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="font-pixel text-2xl md:text-3xl font-black uppercase tracking-tight text-[#0A0A0A]">
              HOW IT WORKS
            </h2>
            <div className="h-1 w-20 bg-[#0A0A0A] mx-auto" />
            <p className="text-xs font-mono text-[#0A0A0A]/70 uppercase tracking-widest font-bold">
              Tactical 3-Step Setup
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="p-6 bg-[#F5F2E8] border-4 border-[#0A0A0A] shadow-[6px_6px_0px_#0A0A0A]">
              <div className="font-pixel text-3xl font-black text-[#0A0A0A] mb-3">01</div>
              <h3 className="font-pixel text-lg font-bold text-[#0A0A0A] mb-2 uppercase">CREATE</h3>
              <p className="text-sm text-[#0A0A0A]/80 font-mono font-bold leading-relaxed">
                Create your own private server and organize frequencies into public or secret locked private voice channels.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 bg-[#F5F2E8] border-4 border-[#0A0A0A] shadow-[6px_6px_0px_#0A0A0A]">
              <div className="font-pixel text-3xl font-black text-[#3B82F6] mb-3">02</div>
              <h3 className="font-pixel text-lg font-bold text-[#0A0A0A] mb-2 uppercase">INVITE</h3>
              <p className="text-sm text-[#0A0A0A]/80 font-mono font-bold leading-relaxed">
                Share a one-click invite code (<span className="bg-[#FFFFFF] px-1 border border-[#0A0A0A]">WAVE-TAC01</span>) with your crew or teammates.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 bg-[#F5F2E8] border-4 border-[#0A0A0A] shadow-[6px_6px_0px_#0A0A0A]">
              <div className="font-pixel text-3xl font-black text-[#FF304F] mb-3">03</div>
              <h3 className="font-pixel text-lg font-bold text-[#0A0A0A] mb-2 uppercase">TALK</h3>
              <p className="text-sm text-[#0A0A0A]/80 font-mono font-bold leading-relaxed">
                Hold the physical PTT key (or spacebar) and speak. Hardware-authentic roger beeps alert everyone when the channel is clear.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="border-t-4 border-[#0A0A0A] py-16 px-6 max-w-6xl mx-auto">
        <div className="text-center space-y-2 mb-12">
          <h2 className="font-pixel text-2xl md:text-3xl font-black uppercase tracking-tight text-[#0A0A0A]">
            RADIO CAPABILITIES
          </h2>
          <div className="h-1 w-20 bg-[#0A0A0A] mx-auto" />
          <p className="text-xs font-mono text-[#0A0A0A]/70 uppercase tracking-widest font-bold">
            Engineered for high-stress, low-friction voice transmission
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-5 bg-[#FFFFFF] border-4 border-[#0A0A0A] shadow-[6px_6px_0px_#0A0A0A] space-y-2">
            <div className="flex items-center gap-2 text-[#0A0A0A]">
              <Mic size={20} />
              <h4 className="font-pixel text-sm font-black uppercase">PUSH-TO-TALK</h4>
            </div>
            <p className="text-xs font-bold text-[#0A0A0A]/70 leading-relaxed">
              True walkie-talkie half-duplex mechanism. Only one operator transmits at any moment with real-time atomic locking.
            </p>
          </div>

          <div className="p-5 bg-[#FFFFFF] border-4 border-[#0A0A0A] shadow-[6px_6px_0px_#0A0A0A] space-y-2">
            <div className="flex items-center gap-2 text-[#0A0A0A]">
              <Volume2 size={20} />
              <h4 className="font-pixel text-sm font-black uppercase">TACTILE SOUNDS</h4>
            </div>
            <p className="text-xs font-bold text-[#0A0A0A]/70 leading-relaxed">
              Hardware-style mechanical click, synthesized radio squelch bursts, and nostalgic end-of-transmission roger beeps.
            </p>
          </div>

          <div className="p-5 bg-[#FFFFFF] border-4 border-[#0A0A0A] shadow-[6px_6px_0px_#0A0A0A] space-y-2">
            <div className="flex items-center gap-2 text-[#0A0A0A]">
              <Zap size={20} />
              <h4 className="font-pixel text-sm font-black uppercase">WEBRTC AUDIO</h4>
            </div>
            <p className="text-xs font-bold text-[#0A0A0A]/70 leading-relaxed">
              Direct peer-to-peer audio mesh network via Opus codec. Sub-100ms ultra-low latency audio path.
            </p>
          </div>

          <div className="p-5 bg-[#FFFFFF] border-4 border-[#0A0A0A] shadow-[6px_6px_0px_#0A0A0A] space-y-2">
            <div className="flex items-center gap-2 text-[#0A0A0A]">
              <Users size={20} />
              <h4 className="font-pixel text-sm font-black uppercase">SERVERS & CHANNELS</h4>
            </div>
            <p className="text-xs font-bold text-[#0A0A0A]/70 leading-relaxed">
              Multi-frequency servers with simple invite codes and instantaneous channel jumping with no reconnect lag.
            </p>
          </div>

          <div className="p-5 bg-[#FFFFFF] border-4 border-[#0A0A0A] shadow-[6px_6px_0px_#0A0A0A] space-y-2">
            <div className="flex items-center gap-2 text-[#0A0A0A]">
              <Lock size={20} />
              <h4 className="font-pixel text-sm font-black uppercase">PRIVATE FREQUENCIES</h4>
            </div>
            <p className="text-xs font-bold text-[#0A0A0A]/70 leading-relaxed">
              Encrypted tactical private frequencies limited only to invited team operators and command officers.
            </p>
          </div>

          <div className="p-5 bg-[#FFFFFF] border-4 border-[#0A0A0A] shadow-[6px_6px_0px_#0A0A0A] space-y-2">
            <div className="flex items-center gap-2 text-[#0A0A0A]">
              <Smartphone size={20} />
              <h4 className="font-pixel text-sm font-black uppercase">RESPONSIVE & PWA</h4>
            </div>
            <p className="text-xs font-bold text-[#0A0A0A]/70 leading-relaxed">
              Engineered with full touch hold support for phones, tablets, and field devices with responsive brutalist aesthetics.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-4 border-[#0A0A0A] bg-[#0A0A0A] text-[#FFFFFF] py-8 px-6 text-center text-xs font-bold">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-pixel tracking-wider text-[#39FF14]">WAVE</span>
            <span>— TACTICAL INTERNET WALKIE-TALKIE</span>
          </div>
          <div className="text-[10px] text-[#FFFFFF]/70 uppercase tracking-widest">
            104.7 MHZ • PUSH. TALK. RELEASE.
          </div>
        </div>
      </footer>
    </div>
  );
};
