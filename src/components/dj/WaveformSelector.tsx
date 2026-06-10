import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, 
  Pause, 
  X, 
  Check, 
  Loader2, 
  Volume2, 
  VolumeX, 
  Music,
  Maximize2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WaveformSelectorProps {
  audioUrl: string;
  musicName: string;
  initialDuration?: string; // e.g. "01:20"
  onConfirm: (duration: string) => void;
  onClose: () => void;
  isInline?: boolean;
}

export function WaveformSelector({ 
  audioUrl, 
  musicName, 
  initialDuration = '', 
  onConfirm, 
  onClose,
  isInline = false
}: WaveformSelectorProps) {
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  
  // The chosen drop time in seconds
  const [selectedDropTime, setSelectedDropTime] = useState<number>(0);
  
  // Wave data: array of floats between 0 and 1
  const [peaks, setPeaks] = useState<number[]>([]);
  const [isFallback, setIsFallback] = useState(false);

  // References
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Parse initial duration (Ex: "01:20" or "80")
  useEffect(() => {
    if (initialDuration) {
      const parts = initialDuration.split(':');
      if (parts.length === 2) {
        const mins = parseInt(parts[0], 10) || 0;
        const secs = parseInt(parts[1], 10) || 0;
        setSelectedDropTime(mins * 60 + secs);
      } else {
        const secs = parseInt(initialDuration, 10);
        if (!isNaN(secs)) {
          setSelectedDropTime(secs);
        }
      }
    }
  }, [initialDuration]);

  // Load and decode Audio 
  useEffect(() => {
    let isCancelled = false;

    async function loadAudio() {
      setLoading(true);
      setErrorText(null);
      setIsFallback(false);

      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Attempt to fetch audio array buffer for accurate waveform
        const response = await fetch(audioUrl, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        
        if (isCancelled) return;

        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        if (isCancelled) return;

        // Downsample channel data into peak points
        const channelData = audioBuffer.getChannelData(0);
        const barSamplesCount = 180; // beautiful resolution of waveform bars
        const step = Math.ceil(channelData.length / barSamplesCount);
        const parsedPeaks: number[] = [];

        // First find the maximum peak in the entire track to normalize perfectly
        let trackMax = 0;
        for (let i = 0; i < channelData.length; i++) {
          const val = Math.abs(channelData[i]);
          if (val > trackMax) trackMax = val;
        }
        if (trackMax === 0) trackMax = 1.0;

        for (let i = 0; i < barSamplesCount; i++) {
          let max = 0;
          const start = i * step;
          const end = Math.min(start + step, channelData.length);
          for (let j = start; j < end; j++) {
            const val = Math.abs(channelData[j]);
            if (val > max) max = val;
          }
          // Normalize to maximum of the track
          let normalized = max / trackMax;
          
          // Apply a non-linear dynamic range expansion to accentuate drops (high peaks) and breaks/vocals (low peaks)
          // We shift the quiet parts down and stretch the loud parts back to the top.
          const expandedThreshold = 0.30;
          const expanded = normalized < expandedThreshold 
            ? (normalized / expandedThreshold) * 0.12 // damp breaks/vocals very low
            : 0.12 + ((normalized - expandedThreshold) / (1.0 - expandedThreshold)) * 0.88; // scale drops high
          
          const highContrast = Math.pow(expanded, 1.8);
          
          // Ensure it has a gentle minimum line so no section is completely invisible
          parsedPeaks.push(Math.min(Math.max(highContrast, 0.05), 1.0));
        }

        setPeaks(parsedPeaks);
        setDuration(audioBuffer.duration);
        setLoading(false);
      } catch (err) {
        console.warn("Waveform decoding failed (likely CORS or format). Using high-fidelity synthetic fallback.", err);
        if (isCancelled) return;

        // Create a gorgeous DJ track layout with highly deformed visual properties
        // Composed of: low intro, rising buildup, pulsing massive drops, silent breakdown.
        const barSamplesCount = 180;
        const fallbackPeaks: number[] = [];
        for (let i = 0; i < barSamplesCount; i++) {
          const ratio = i / barSamplesCount;
          let base = 0.2;
          
          if (ratio < 0.15) { // Intro
            base = 0.05 + Math.abs(Math.sin(ratio * Math.PI * 12)) * 0.10;
          } else if (ratio >= 0.15 && ratio < 0.30) { // Build up wave
            base = 0.10 + (ratio - 0.15) * 3.5 + Math.abs(Math.sin(ratio * Math.PI * 24)) * 0.08;
          } else if (ratio >= 0.30 && ratio < 0.52) { // Massive Drop 1 (high pumping bass)
            base = 0.75 + Math.abs(Math.sin(ratio * Math.PI * 36)) * 0.25;
          } else if (ratio >= 0.52 && ratio < 0.68) { // Deep breakdown / Vocals / Breaks (super quiet)
            base = 0.04 + Math.abs(Math.cos(ratio * Math.PI * 10)) * 0.08;
          } else if (ratio >= 0.68 && ratio < 0.88) { // Climax drop 2 (loud pumping climax)
            base = 0.80 + Math.abs(Math.cos(ratio * Math.PI * 44)) * 0.20;
          } else { // Outro
            base = 0.15 - (ratio - 0.88) * 1.0 + Math.abs(Math.sin(ratio * Math.PI * 12)) * 0.06;
          }
          fallbackPeaks.push(Math.max(Math.min(base, 1.0), 0.04));
        }

        setPeaks(fallbackPeaks);
        setIsFallback(true);
        // The duration will be loaded by the <audio> element itself
        setLoading(false);
      }
    }

    loadAudio();

    return () => {
      isCancelled = true;
    };
  }, [audioUrl]);

  // Sync state with HTML5 audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);

    // Set path
    audio.src = audioUrl;
    audio.load();

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.pause();
    };
  }, [audioUrl]);

  // Handle vol and mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Handle play-pause toggle
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(e => console.warn("Failed to play audio:", e));
    }
  };

  // Skip back or forward
  const skipTime = (amount: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + amount));
  };

  // Convert time to "mm:ss"
  const formatTime = (timeInSecs: number) => {
    if (isNaN(timeInSecs)) return '00:00';
    const m = Math.floor(timeInSecs / 60);
    const s = Math.floor(timeInSecs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Handle clicking & dragging on the waveform
  const handleTimelineInteraction = (clientX: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const targetTime = percentage * duration;

    // Move playback needle in standard HTML5 audio
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
    setCurrentTime(targetTime);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    handleTimelineInteraction(e.clientX);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleTimelineInteraction(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const setAsDropTime = () => {
    setSelectedDropTime(currentTime);
  };

  const handleConfirmSelection = () => {
    const formatted = formatTime(selectedDropTime);
    onConfirm(formatted);
    onClose();
  };

  // Draw audio spectrum canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI retina screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    // Calculate progression
    const playPercent = duration > 0 ? currentTime / duration : 0;
    const dropPercent = duration > 0 ? selectedDropTime / duration : 0;

    const barCount = peaks.length;
    const spacing = 2; // px spacing
    const barWidth = (width - (spacing * (barCount - 1))) / barCount;

    for (let i = 0; i < barCount; i++) {
      const peak = peaks[i];
      const barHeight = peak * (height - 20); // Give some padding for drop marker
      const x = i * (barWidth + spacing);
      const y = (height - barHeight) / 2; // centered vertically

      const currentPercent = i / barCount;

      // Color coding:
      // Past playhead: Pink/purple glow segment
      // Future: Slate/desaturated
      let gradient: CanvasGradient;
      if (currentPercent <= playPercent) {
        gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, '#ec4899'); // Pink
        gradient.addColorStop(1, '#a855f7'); // Purple
      } else {
        gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, '#334155'); // Gray-700
        gradient.addColorStop(1, '#1e293b'); // Gray-800
      }

      // Draw rounded bar
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    }

    // Draw the "Chosen Drop Point" flag line
    if (selectedDropTime > 0 && selectedDropTime <= duration) {
      const dropX = dropPercent * width;
      
      // Draw vertical drop marker
      ctx.strokeStyle = '#f59e0b'; // Amber Accent
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(dropX, 5);
      ctx.lineTo(dropX, height - 5);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw drop dot marker at the top
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(dropX, 5, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw the active playback line
    if (currentTime > 0) {
      const needleX = playPercent * width;
      ctx.strokeStyle = '#ffffff'; // White playback head
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(needleX, 0);
      ctx.lineTo(needleX, height);
      ctx.stroke();

      // Small needle indicator at bottom
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(needleX - 4, height);
      ctx.lineTo(needleX + 4, height);
      ctx.lineTo(needleX, height - 6);
      ctx.closePath();
      ctx.fill();
    }

  }, [peaks, currentTime, duration, selectedDropTime]);

  if (isInline) {
    return (
      <div className="w-full bg-purple-950/20 border border-purple-500/20 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 mt-3 animate-in fade-in slide-in-from-top-3 duration-200">
        <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-pink-400 shrink-0" />
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Ajuste Visual do Drop
              </h4>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate max-w-[200px] sm:max-w-md">
                Track: <span className="text-purple-400">{musicName}</span>
              </p>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={onClose}
            className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
          >
            Fechar
          </button>
        </div>

        {/* Loading / Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
            <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest">
              Analisando frequências da track...
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            
            {/* Visualizer Frame */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-400">
                <span>Espectro Sonoro</span>
                {isFallback ? (
                  <span className="text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full text-[8px] scale-95 origin-right">
                    Timeline Dinâmica
                  </span>
                ) : (
                  <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[8px] scale-95 origin-right">
                    Waveform Real
                  </span>
                )}
              </div>

              {/* Interactive Timeline Container */}
              <div 
                ref={containerRef} 
                onMouseDown={handleMouseDown}
                className="relative bg-white/[0.01] border border-white/5 rounded-xl p-3 cursor-ew-resize hover:bg-white/[0.02] transition-colors select-none"
              >
                <canvas 
                  ref={canvasRef} 
                  className="w-full h-20 block"
                />

                {selectedDropTime > 0 && (
                  <div 
                    style={{ 
                      left: `${(selectedDropTime / (duration || 1)) * 100}%`,
                      transform: 'translateX(-50%)'
                    }}
                    className="absolute top-1 bg-amber-500 border border-amber-400 text-slate-950 font-black text-[8px] uppercase px-1.5 py-0.2 rounded shadow pointer-events-none transition-all flex items-center gap-1 shrink-0"
                  >
                    <span>DROP: {formatTime(selectedDropTime)}</span>
                  </div>
                )}
              </div>

              {/* Time displays */}
              <div className="flex justify-between text-[10px] font-bold font-mono text-slate-500 px-1">
                <span>{formatTime(currentTime)}</span>
                <span className="text-[8px] text-pink-400 font-extrabold uppercase tracking-wider text-center hidden sm:inline">
                  Arraste para pinçar o momento do drop
                </span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Selection HUD & Marker Trigger */}
            <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="space-y-0.5 text-center sm:text-left">
                <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest block">
                  Drop Selecionado
                </p>
                <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                  <span className="text-lg font-black text-white font-mono">
                    {formatTime(selectedDropTime)}
                  </span>
                  {selectedDropTime > 0 && (
                    <span className="text-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded-full font-bold">
                      Marcado
                    </span>
                  )}
                </div>
              </div>

              <Button
                type="button"
                onClick={setAsDropTime}
                className="w-full sm:w-auto bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 border border-purple-500/20 font-black uppercase text-[9px] tracking-widest rounded-xl h-9 px-4 transition-all flex items-center justify-center gap-1.5"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Marcar {formatTime(currentTime)} de Drop
              </Button>
            </div>

            {/* Audio Deck Controls Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/5 pt-3">
              
              {/* Playback Controls */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => skipTime(-10)}
                  className="rounded-full w-8 h-8 p-0 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-mono"
                  title="Voltar 10s"
                >
                  -10s
                </Button>

                <Button
                  type="button"
                  onClick={togglePlay}
                  className={cn(
                    "rounded-full w-10 h-10 p-0 flex items-center justify-center border transition-all shadow-[0_0_10px_rgba(236,72,153,0.1)]",
                    isPlaying 
                      ? "bg-pink-500 border-pink-400 text-white hover:bg-pink-600" 
                      : "bg-white text-slate-950 border-white hover:bg-slate-100"
                  )}
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  )}
                </Button>

                <Button
                  type="button"
                  onClick={() => skipTime(10)}
                  className="rounded-full w-8 h-8 p-0 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-mono"
                  title="Avançar 10s"
                >
                  +10s
                </Button>
              </div>

              {/* Volume details */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-slate-400 hover:text-white transition-colors p-1"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    setIsMuted(false);
                  }}
                  className="w-16 accent-pink-500 h-1 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              {/* Action Save Buttons */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 sm:flex-initial rounded-xl h-9 border-white/10 hover:bg-white/5 font-black uppercase tracking-widest text-[8px]"
                >
                  Descartar
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmSelection}
                  disabled={selectedDropTime <= 0}
                  className="flex-1 sm:flex-initial rounded-xl h-9 bg-pink-500 hover:bg-pink-600 text-white font-black uppercase tracking-widest text-[8px] shadow-[0_0_10px_rgba(236,72,153,0.15)] flex items-center justify-center gap-1 border-none"
                >
                  <Check className="w-3 h-3" />
                  Confirmar Drop
                </Button>
              </div>

            </div>

          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" onClick={onClose} />

      {/* Popup Container */}
      <div className="relative w-full max-w-3xl bg-neutral-900 border border-white/10 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
        <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-pink-500/10 rounded-xl border border-pink-500/20">
              <Music className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                Seletor Visual de Drop
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate max-w-[280px] sm:max-w-md">
                Ajustando áudio: <span className="text-purple-400">{musicName}</span>
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loading / Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
            <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">
              Analisando frequências da track...
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            
            {/* Visualizer Frame */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Espectro Sonoro da Faixa</span>
                
                {isFallback ? (
                  <span className="text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full text-[8px] animate-pulse">
                    Timeline Dinâmica
                  </span>
                ) : (
                  <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[8px]">
                    Waveform 100% Real
                  </span>
                )}
              </div>

              {/* Interactive Timeline Container */}
              <div 
                ref={containerRef} 
                onMouseDown={handleMouseDown}
                className="relative bg-white/[0.02] border border-white/5 rounded-2xl p-4 cursor-ew-resize hover:bg-white/[0.04] transition-colors select-none"
              >
                {/* Canvas height is 160px for premium feel */}
                <canvas 
                  ref={canvasRef} 
                  className="w-full h-32 block"
                />

                {/* Drop Marker Label Badge floating near the marker */}
                {selectedDropTime > 0 && (
                  <div 
                    style={{ 
                      left: `${(selectedDropTime / (duration || 1)) * 100}%`,
                      transform: 'translateX(-50%)'
                    }}
                    className="absolute top-1 bg-amber-500 border border-amber-400 text-slate-950 font-black text-[9px] uppercase px-1.5 py-0.2 rounded shadow-lg pointer-events-none transition-all flex items-center gap-1 shrink-0"
                  >
                    <span>DROP: {formatTime(selectedDropTime)}</span>
                  </div>
                )}
              </div>

              {/* Time displays */}
              <div className="flex justify-between text-xs font-bold font-mono text-slate-500 px-1">
                <span>{formatTime(currentTime)}</span>
                <span className="text-[10px] text-pink-400 font-extrabold uppercase tracking-widest">
                  Clique na onda para navegar • Marque seu drop
                </span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Selection HUD & Marker Trigger */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">
                  Ponto do Drop Escolhido
                </p>
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <span className="text-2xl font-black text-white font-mono tracking-tight">
                    {formatTime(selectedDropTime)}
                  </span>
                  {selectedDropTime > 0 && (
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">
                      Marcado
                    </span>
                  )}
                </div>
              </div>

              <Button
                type="button"
                onClick={setAsDropTime}
                className="w-full sm:w-auto bg-purple-500/20 text-purple-400 border border-purple-500/30 font-black uppercase text-xs rounded-xl h-10 px-5 hover:bg-purple-500/30 transition-all flex items-center justify-center gap-2"
              >
                <Maximize2 className="w-4 h-4" />
                Marcar {formatTime(currentTime)} de Drop
              </Button>
            </div>

            {/* Audio Deck Controls Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5 pt-4">
              
              {/* Playback Controls */}
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  onClick={() => skipTime(-10)}
                  className="rounded-full w-9 h-9 p-0 bg-white/5 hover:bg-white/10 text-white border border-white/10"
                  title="Voltar 10s"
                >
                  -10s
                </Button>

                <Button
                  type="button"
                  onClick={togglePlay}
                  className={cn(
                    "rounded-full w-12 h-12 p-0 flex items-center justify-center border transition-all shadow-[0_0_15px_rgba(236,72,153,0.15)]",
                    isPlaying 
                      ? "bg-pink-500 border-pink-400 text-white hover:bg-pink-600" 
                      : "bg-white text-slate-950 border-white hover:bg-slate-100"
                  )}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </Button>

                <Button
                  type="button"
                  onClick={() => skipTime(10)}
                  className="rounded-full w-9 h-9 p-0 bg-white/5 hover:bg-white/10 text-white border border-white/10"
                  title="Avançar 10s"
                >
                  +10s
                </Button>
              </div>

              {/* Volume details */}
              <div className="flex items-center gap-2 w-full sm:w-auto max-w-[150px]">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-slate-400 hover:text-white transition-colors p-1"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    setIsMuted(false);
                  }}
                  className="w-20 accent-pink-500 h-1 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              {/* Action Save Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 sm:flex-initial rounded-xl h-11 border-white/10 hover:bg-white/5 font-black uppercase tracking-widest text-[10px]"
                >
                  Descartar
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmSelection}
                  disabled={selectedDropTime <= 0}
                  className="flex-1 sm:flex-initial rounded-xl h-11 bg-pink-500 hover:bg-pink-600 text-white font-black uppercase tracking-widest text-[10px] shadow-[0_0_15px_rgba(236,72,153,0.3)] flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Confirmar ({formatTime(selectedDropTime)})
                </Button>
              </div>

            </div>

          </div>
        )}
      </div>
    </div>
  );
}
