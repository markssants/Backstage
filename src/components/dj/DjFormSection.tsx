import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  User, Sparkles, Upload, Loader2, Paperclip, Trash2, 
  ShieldAlert, Disc, Image, Film, Music, Clock, Database, Check,
  FolderArchive, Video, Building2, Tag, ArrowRight, RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { DjAgency, DjLabel, DjCatalogItem } from "../../types";
import { searchDjCatalog } from "../../lib/djCatalog";

interface DjFormSectionProps {
  djNumber: 1 | 2;
  title: string;
  theme?: 'purple' | 'pink';
  djName: string;
  onDjNameChange: (val: string) => void;
  
  // Catálogo de DJs e preenchimento automático
  catalog?: DjCatalogItem[];
  onSelectRegisteredDj?: (dj: DjCatalogItem) => void;
  onClearDjFields?: () => void;

  presskitUrl: string;
  presskitType: 'link' | 'file' | 'email';
  onPresskitChange: (url: string, type: 'link' | 'file' | 'email') => void;
  
  hasMandatoryLogo: boolean;
  onHasMandatoryLogoChange: (val: boolean) => void;
  agencies: DjAgency[];
  onAgenciesChange: (val: DjAgency[]) => void;
  hasRecordLabel: boolean;
  onHasRecordLabelChange: (val: boolean) => void;
  labels: DjLabel[];
  onLabelsChange: (val: DjLabel[]) => void;

  hasVisualMaterial: boolean;
  onHasVisualMaterialChange: (val: boolean) => void;
  visualMaterialType: 'both' | 'photo' | 'video';
  onVisualMaterialTypeChange: (val: 'both' | 'photo' | 'video') => void;
  flyerPhoto: string;
  flyerPhotoType: 'link' | 'file';
  onFlyerPhotoChange: (url: string, type: 'link' | 'file') => void;
  animationVideo: string;
  animationVideoType: 'link' | 'file';
  onAnimationVideoChange: (url: string, type: 'link' | 'file') => void;

  hasPlaylist: boolean;
  onHasPlaylistChange: (val: boolean) => void;
  musicName: string;
  onMusicNameChange: (val: string) => void;
  musicUrl: string;
  musicUrlType: 'link' | 'file';
  musicDuration: string;
  onMusicDurationChange: (val: string) => void;
  onMusicTypeChange: (type: 'link' | 'file') => void;
  onClearMusic: () => void;
  
  localMusicBlobUrl: string | null;
  uploadingState: Record<string, boolean>;
  uploadProgress: Record<string, number>;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>, fieldKey: string, allowedTypes: string[], maxSizeMB?: number) => void;
  onOpenWaveform: () => void;
  fieldPrefix?: string;
}

function getFriendlyFileName(url: string | undefined): string {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    const nameParam = urlObj.searchParams.get('name');
    if (nameParam) return decodeURIComponent(nameParam);
  } catch (e) {}
  try {
    const decoded = decodeURIComponent(url);
    const parts = decoded.split('/');
    let lastPart = parts[parts.length - 1];
    if (lastPart.includes('?')) {
      lastPart = lastPart.split('?')[0];
    }
    const subParts = lastPart.split('/');
    let segment = subParts[subParts.length - 1];
    segment = segment.replace(/^\d+_/g, '');
    return segment || 'Arquivo';
  } catch (e) {
    return 'Arquivo';
  }
}

function isUploadedFile(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes('firebasestorage') || 
         url.includes('/uploads/') || 
         url.includes('drive.google.com') || 
         url.includes('googleapis.com');
}

export function DjFormSection({
  djNumber,
  title,
  theme = 'purple',
  djName,
  onDjNameChange,
  catalog = [],
  onSelectRegisteredDj,
  onClearDjFields,
  presskitUrl,
  presskitType,
  onPresskitChange,
  hasMandatoryLogo,
  onHasMandatoryLogoChange,
  agencies,
  onAgenciesChange,
  hasRecordLabel,
  onHasRecordLabelChange,
  labels,
  onLabelsChange,
  hasVisualMaterial,
  onHasVisualMaterialChange,
  visualMaterialType,
  onVisualMaterialTypeChange,
  flyerPhoto,
  flyerPhotoType,
  onFlyerPhotoChange,
  animationVideo,
  animationVideoType,
  onAnimationVideoChange,
  hasPlaylist,
  onHasPlaylistChange,
  musicName,
  onMusicNameChange,
  musicUrl,
  musicUrlType,
  musicDuration,
  onMusicDurationChange,
  onMusicTypeChange,
  onClearMusic,
  localMusicBlobUrl,
  uploadingState,
  uploadProgress,
  onFileUpload,
  onOpenWaveform,
  fieldPrefixDir = '',
  fieldPrefix = ''
}: DjFormSectionProps & { fieldPrefixDir?: string }) {
  const [durationMode, setDurationMode] = useState<'time' | 'visual'>(
    musicUrlType === 'file' ? 'visual' : 'time'
  );
  
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadedFromDbName, setLoadedFromDbName] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const matchedDjs = useMemo(() => {
    return searchDjCatalog(djName, catalog);
  }, [djName, catalog]);

  // Reseta o índice destacado quando as sugestões mudam
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [matchedDjs]);

  // Fecha o dropdown de sugestões ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (dj: DjCatalogItem) => {
    if (onSelectRegisteredDj) {
      onSelectRegisteredDj(dj);
    } else {
      onDjNameChange(dj.name);
    }
    setLoadedFromDbName(dj.name);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || matchedDjs.length === 0) {
      if (e.key === 'ArrowDown' && matchedDjs.length > 0) {
        setShowSuggestions(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < matchedDjs.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : matchedDjs.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < matchedDjs.length) {
        e.preventDefault();
        handleSelectSuggestion(matchedDjs[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const presskitKeyOk = `${fieldPrefix}presskit`;
  const flyerPhotoKeyOk = `${fieldPrefix}flyerPhoto`;
  const animationVideoKeyOk = `${fieldPrefix}animationVideo`;
  const musicKeyOk = `${fieldPrefix}musicUrl`;

  const presskitKey = presskitKeyOk;
  const flyerPhotoKey = flyerPhotoKeyOk;
  const animationVideoKey = animationVideoKeyOk;
  const musicKey = musicKeyOk;

  const isPink = theme === 'pink';

  return (
    <div className={cn(
      "rounded-3xl p-4 sm:p-6 space-y-6 border transition-all",
      isPink 
        ? "bg-pink-950/10 border-pink-500/20 shadow-[0_0_30px_rgba(236,72,153,0.05)]" 
        : "bg-purple-950/10 border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.05)]"
    )}>
      {/* Section Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs text-white shadow-lg",
            isPink ? "bg-gradient-to-tr from-pink-500 to-rose-500" : "bg-gradient-to-tr from-purple-500 to-indigo-500"
          )}>
            {djNumber}
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
              {title}
            </h4>
            <p className="text-[10px] text-slate-400 font-medium">
              Preencha os dados e materiais da atração {djNumber}
            </p>
          </div>
        </div>
        <span className={cn(
          "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border",
          isPink ? "bg-pink-500/10 text-pink-400 border-pink-500/20" : "bg-purple-500/10 text-purple-400 border-purple-500/20"
        )}>
          {djName ? djName : `DJ ${djNumber}`}
        </span>
      </div>

      {/* 1 - Identificação & Presskit */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-white/5">
          <User className={cn("w-4 h-4", isPink ? "text-pink-400" : "text-purple-400")} />
          <span className="text-[10px] uppercase font-black tracking-widest text-slate-300">
            1- Identificação & Presskit (DJ {djNumber})
          </span>
        </div>
        
        {/* Campo com Autocomplete do Banco de Dados */}
        <div className="space-y-2 relative" ref={searchContainerRef}>
          <div className="flex items-center justify-between">
            <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
              Nome do DJ / Atração {djNumber} <span className="text-pink-500 font-bold">*</span>
            </Label>
            
            {matchedDjs.length > 0 && djName.trim().length > 0 && !loadedFromDbName && (
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                <Database className="w-3 h-3" />
                {matchedDjs.length} cadastrado(s) no DB
              </span>
            )}
          </div>

          <div className="relative">
            <Input 
              value={djName} 
              onChange={e => {
                onDjNameChange(e.target.value);
                setShowSuggestions(true);
                if (loadedFromDbName && e.target.value.trim() !== loadedFromDbName) {
                  setLoadedFromDbName(null);
                }
              }} 
              onFocus={() => {
                if (matchedDjs.length > 0) setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              spellCheck={false}
              placeholder={`Ex: DJ ${djNumber === 1 ? 'Alok' : 'Vintage Culture'}`} 
              className={cn(
                "rounded-2xl bg-white/5 border-white/10 text-white h-12 text-sm font-bold transition-all pr-10",
                matchedDjs.length > 0 && djName.trim().length > 0 && "border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
              )}
            />
            {matchedDjs.length > 0 && djName.trim().length > 0 && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setShowSuggestions(prev => !prev);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-pink-400 transition-colors p-1"
                title="Ver atrações cadastradas no banco de dados"
              >
                <Database className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Banner quando dados foram carregados do DB */}
          {loadedFromDbName && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-500/15 via-purple-500/10 to-transparent border border-emerald-500/30 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2 text-emerald-300">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold">
                  Dados de <strong>{loadedFromDbName}</strong> puxados automaticamente do Banco de Dados!
                </span>
              </div>
              {onClearDjFields && (
                <button
                  type="button"
                  onClick={() => {
                    onClearDjFields();
                    setLoadedFromDbName(null);
                  }}
                  className="text-[10px] text-slate-400 hover:text-rose-400 font-bold uppercase tracking-widest flex items-center gap-1 transition-colors bg-white/5 px-2 py-1 rounded-lg border border-white/10 shrink-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  Limpar
                </button>
              )}
            </motion.div>
          )}

          {/* Dropdown Flutuante de Sugestões de DJs Cadastrados */}
          <AnimatePresence>
            {showSuggestions && matchedDjs.length > 0 && djName.trim().length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute z-50 left-0 right-0 top-full mt-2 bg-[#120a26]/95 backdrop-blur-2xl border border-purple-500/40 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.8)] overflow-hidden"
              >
                <div className="p-3 bg-gradient-to-r from-purple-900/50 to-pink-900/40 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[10px] uppercase font-black tracking-widest text-purple-200">
                      DJs Cadastrados no Banco de Dados
                    </span>
                  </div>
                  <span className="text-[9px] text-purple-300 font-bold bg-white/10 px-2 py-0.5 rounded-full">
                    {matchedDjs.length} {matchedDjs.length === 1 ? 'resultado' : 'resultados'} (Clique para puxar)
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                  {matchedDjs.map((dj, idx) => {
                    const isSelected = highlightedIndex === idx;
                    return (
                      <div
                        key={dj.id || idx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSelectSuggestion(dj);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectSuggestion(dj);
                        }}
                        className={cn(
                          "group cursor-pointer p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5",
                          isSelected
                            ? "bg-gradient-to-r from-purple-600/30 to-pink-600/30 border-purple-500 shadow-md"
                            : "bg-white/[0.03] hover:bg-gradient-to-r hover:from-purple-600/20 hover:to-pink-600/20 border-white/5 hover:border-purple-500/40"
                        )}
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white shrink-0 shadow-md">
                              <Disc className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-sm font-black text-white group-hover:text-pink-300 transition-colors truncate">
                              {dj.name}
                            </span>
                            {dj.presskitUrl && (
                              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
                                Presskit OK
                              </span>
                            )}
                          </div>

                          {/* Badges dos dados disponíveis no cadastro */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-300">
                            {dj.presskitUrl && (
                              <span className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <FolderArchive className="w-2.5 h-2.5 text-purple-400" />
                                {dj.presskitType === 'email' ? 'E-mail' : dj.presskitType === 'file' ? '.zip' : 'Link'}
                              </span>
                            )}
                            {dj.flyerPhoto && (
                              <span className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Image className="w-2.5 h-2.5 text-pink-400" />
                                Foto Flyer
                              </span>
                            )}
                            {dj.animationVideo && (
                              <span className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Video className="w-2.5 h-2.5 text-blue-400" />
                                Vídeo Motion
                              </span>
                            )}
                            {dj.musicName && (
                              <span className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded flex items-center gap-1 truncate max-w-[140px]">
                                <Music className="w-2.5 h-2.5 text-amber-400" />
                                {dj.musicName}
                              </span>
                            )}
                            {dj.agencies && dj.agencies.length > 0 && dj.agencies.some(a => a.name) && (
                              <span className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Building2 className="w-2.5 h-2.5 text-indigo-400" />
                                {dj.agencies.filter(a => a.name).length} Agência(s)
                              </span>
                            )}
                          </div>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSelectSuggestion(dj);
                          }}
                          className="h-8 text-[9px] font-black uppercase tracking-widest px-3 bg-purple-600 hover:bg-pink-600 text-white rounded-lg shadow-md group-hover:scale-105 transition-all flex items-center gap-1 shrink-0"
                        >
                          Puxar Dados
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
              Como deseja enviar o Presskit?
            </Label>
            <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10 w-full sm:w-auto overflow-hidden">
              <button
                type="button"
                onClick={() => onPresskitChange('', 'link')}
                className={cn(
                  "flex-1 sm:flex-initial rounded-lg text-[8px] font-black uppercase tracking-widest h-7 px-3 transition-all cursor-pointer truncate",
                  (presskitType || 'link') === 'link'
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                Link / URL
              </button>
              <button
                type="button"
                onClick={() => onPresskitChange('', 'file')}
                className={cn(
                  "flex-1 sm:flex-initial rounded-lg text-[8px] font-black uppercase tracking-widest h-7 px-3 transition-all cursor-pointer truncate",
                  presskitType === 'file'
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                Arquivo .zip
              </button>
              <button
                type="button"
                onClick={() => onPresskitChange('beysarts@gmail.com', 'email')}
                className={cn(
                  "flex-1 sm:flex-initial rounded-lg text-[8px] font-black uppercase tracking-widest h-7 px-3 transition-all cursor-pointer truncate",
                  presskitType === 'email'
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                Via E-mail
              </button>
            </div>
          </div>

          {(presskitType || 'link') === 'link' ? (
            <Input 
              value={presskitUrl || ''} 
              onChange={e => onPresskitChange(e.target.value, 'link')} 
              placeholder="Link com fotos e release (Drive/Dropbox)" 
              className="rounded-2xl bg-white/5 border-white/10 text-white h-12" 
            />
          ) : presskitType === 'email' ? (
            <div className="space-y-3 p-4 rounded-2xl bg-purple-500/5 border border-purple-500/10">
              <p className="text-[11px] text-purple-300 font-bold leading-relaxed text-center sm:text-left font-sans">
                📨 O material (Presskit e fotos) deve ser enviado diretamente para o e-mail de nossa produção:
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/5 border border-white/10 p-3 rounded-xl">
                <div className="flex items-center gap-2 text-slate-200">
                  <span className="text-sm">📧</span>
                  <span className="text-xs font-mono font-bold tracking-wider select-all">beysarts@gmail.com</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText('beysarts@gmail.com');
                  }}
                  className="w-full sm:w-auto h-8 rounded-lg text-[9px] font-black uppercase tracking-widest px-3.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/25 transition-all flex items-center justify-center gap-1.5"
                >
                  Copiar E-mail
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] transition-all rounded-2xl p-4 flex flex-col items-center justify-center min-h-[5rem]">
              {uploadingState[presskitKey] ? (
                <div className="flex flex-col items-center gap-2 w-full max-w-xs py-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                      Enviando arquivo (.zip)... {uploadProgress[presskitKey] !== undefined ? `${uploadProgress[presskitKey]}%` : '0%'}
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5 mt-1">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-300" 
                      style={{ width: `${uploadProgress[presskitKey] || 0}%` }}
                    />
                  </div>
                </div>
              ) : isUploadedFile(presskitUrl) ? (
                <div className="flex flex-col sm:flex-row items-center justify-between w-full bg-purple-950/20 border border-purple-500/20 p-4 rounded-2xl gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400 shrink-0">
                      <Paperclip className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-purple-400 mb-0.5">Presskit (.zip) Carregado</p>
                      <p className="text-sm text-slate-200 font-bold truncate" title={getFriendlyFileName(presskitUrl)}>
                        {getFriendlyFileName(presskitUrl)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        onPresskitChange('', 'file');
                      }}
                      className="h-9 px-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 shadow-none"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Apagar Presskit
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <label htmlFor={`${presskitKey}-file-input`} className="flex flex-col items-center gap-2 cursor-pointer w-full h-full py-4 text-center">
                    <Upload className="w-6 h-6 text-slate-400 hover:text-purple-400 transition-colors" />
                    <span className="text-xs text-slate-300 font-extrabold max-w-[200px] leading-tight">Escolher Presskit (.zip)</span>
                    <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">Clique para selecionar documento</span>
                  </label>
                  <input
                    id={`${presskitKey}-file-input`}
                    type="file"
                    accept=".zip"
                    onChange={(e) => onFileUpload(e, presskitKey, ['.zip'])}
                    className="hidden"
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2 - Logos Obrigatórios (Agências e Gravadoras) */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-300">
              2- Logos Obrigatórios do DJ {djNumber}
            </span>
          </div>
          <Checkbox 
            id={`${fieldPrefix}mandatory-logo`} 
            checked={hasMandatoryLogo}
            onCheckedChange={(checked) => {
              const isChecked = checked === true;
              onHasMandatoryLogoChange(isChecked);
              if (isChecked && (!agencies || agencies.length === 0)) {
                onAgenciesChange([{ name: '', link: '', type: 'link' }]);
              }
              if (isChecked && (!labels || labels.length === 0)) {
                onLabelsChange([{ name: '', link: '', type: 'link' }]);
              }
            }}
            className="border-slate-500 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
          />
        </div>

        <AnimatePresence initial={false}>
          {hasMandatoryLogo && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-6 overflow-hidden pt-2"
            >
              {/* Agências */}
              <div className="space-y-3">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                  Agência / Bookings Obrigatórias (DJ {djNumber})
                </Label>
                
                <div className="space-y-3">
                  {agencies.map((agency, idx) => {
                    const agencyKey = `${fieldPrefix}agency_${idx}`;
                    return (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white/[0.01] border border-white/5 p-3 rounded-2xl relative">
                        <div className="space-y-1 col-span-1 sm:col-span-2">
                          <Label className="text-[9px] uppercase font-bold tracking-widest text-slate-400 flex items-center justify-between">
                            <span>Nome da Agência <span className="text-pink-500 font-bold">*</span></span>
                            {agencies.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...agencies];
                                  updated.splice(idx, 1);
                                  onAgenciesChange(updated);
                                }}
                                className="text-slate-500 hover:text-rose-500 transition-colors uppercase font-black text-[8px] tracking-wider"
                              >
                                Remover
                              </button>
                            )}
                          </Label>
                          <Input 
                            value={agency.name} 
                            onChange={e => {
                              const updated = [...agencies];
                              updated[idx] = { ...updated[idx], name: e.target.value };
                              onAgenciesChange(updated);
                            }}
                            placeholder="Nome da Agência"
                            className="rounded-xl bg-white/5 border-white/10 text-white h-10 px-4"
                          />
                        </div>

                        <div className="space-y-2 col-span-1 sm:col-span-2 border-t border-white/5 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <Label className="text-[9px] uppercase font-bold tracking-widest text-slate-400">
                            Logo da Agência <span className="text-pink-500 font-bold">*</span>
                          </Label>
                          <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10 w-fit">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...agencies];
                                updated[idx] = { ...updated[idx], type: 'link' };
                                onAgenciesChange(updated);
                              }}
                              className={cn(
                                "rounded-lg text-[8px] font-black uppercase tracking-widest h-6 px-2 transition-all cursor-pointer",
                                (agency.type || 'link') === 'link'
                                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                                  : "text-slate-500 hover:text-slate-300"
                              )}
                            >
                              Link / URL
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...agencies];
                                updated[idx] = { ...updated[idx], type: 'file' };
                                onAgenciesChange(updated);
                              }}
                              className={cn(
                                "rounded-lg text-[8px] font-black uppercase tracking-widest h-6 px-2 transition-all cursor-pointer",
                                agency.type === 'file'
                                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                                  : "text-slate-500 hover:text-slate-300"
                              )}
                            >
                              Enviar Arquivo (.png, .jpg)
                            </button>
                          </div>
                        </div>

                        <div className="col-span-1 sm:col-span-2">
                          {(agency.type || 'link') === 'link' ? (
                            <Input 
                              value={agency.link} 
                              onChange={e => {
                                const updated = [...agencies];
                                updated[idx] = { ...updated[idx], link: e.target.value };
                                onAgenciesChange(updated);
                              }}
                              placeholder="Link ou caminho do arquivo"
                              className="rounded-xl bg-white/5 border-white/10 text-white h-10 px-4"
                            />
                          ) : (
                            <div className="relative border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] transition-all rounded-xl p-3 flex flex-col items-center justify-center min-h-[4rem]">
                              {uploadingState[agencyKey] ? (
                                <div className="flex flex-col items-center gap-1.5 w-full max-w-xs py-1">
                                  <div className="flex items-center gap-1.5">
                                    <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                                    <span className="text-[9px] uppercase font-black tracking-widest text-slate-400">
                                      Enviando imagem... {uploadProgress[agencyKey] !== undefined ? `${uploadProgress[agencyKey]}%` : '0%'}
                                    </span>
                                  </div>
                                  <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden border border-white/5">
                                    <div 
                                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-300" 
                                      style={{ width: `${uploadProgress[agencyKey] || 0}%` }}
                                    />
                                  </div>
                                </div>
                              ) : isUploadedFile(agency.link) ? (
                                <div className="flex flex-col sm:flex-row items-center justify-between w-full bg-purple-950/20 border border-purple-500/20 p-2.5 rounded-xl gap-3">
                                  <div className="flex items-center gap-2.5 w-full sm:w-auto min-w-0">
                                    <div className="w-8 h-8 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                                      <Disc className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[8px] font-black uppercase tracking-wider text-purple-400 mb-0.5">Logo Carregado</p>
                                      <p className="text-xs text-slate-200 font-bold truncate" title={getFriendlyFileName(agency.link)}>
                                        {getFriendlyFileName(agency.link)}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => {
                                        const updated = [...agencies];
                                        updated[idx] = { ...updated[idx], link: '' };
                                        onAgenciesChange(updated);
                                      }}
                                      className="h-7 px-2.5 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1 transition-all bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 shadow-none"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      Apagar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <label htmlFor={`${agencyKey}-file-input`} className="flex flex-col items-center gap-1.5 cursor-pointer w-full h-full py-2 text-center">
                                    <Upload className="w-4 h-4 text-slate-400 hover:text-purple-400 transition-colors" />
                                    <span className="text-[11px] text-slate-300 font-extrabold leading-tight">Escolher Logo da Agência</span>
                                    <span className="text-[8px] text-slate-500 font-medium uppercase tracking-wider">PNG, JPG, SVG</span>
                                  </label>
                                  <input
                                    id={`${agencyKey}-file-input`}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => onFileUpload(e, agencyKey, ['image/'])}
                                    className="hidden"
                                  />
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onAgenciesChange([...agencies, { name: '', link: '', type: 'link' }])}
                  className="rounded-xl border-dashed border-white/20 hover:border-purple-500/50 hover:bg-purple-500/10 text-purple-300 text-[9px] font-black uppercase tracking-widest h-9 w-full flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3" />
                  + Adicionar Outra Agência
                </Button>
              </div>

              {/* Gravadoras */}
              <div className="space-y-3 border-t border-white/5 pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                    Gravadora(s) Obrigatória(s) (DJ {djNumber})
                  </Label>
                  <Checkbox 
                    id={`${fieldPrefix}record-label-toggle`} 
                    checked={hasRecordLabel}
                    onCheckedChange={(checked) => onHasRecordLabelChange(checked === true)}
                    className="border-slate-500 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                  />
                </div>

                {hasRecordLabel && (
                  <div className="space-y-3 pt-2">
                    {labels.map((label, idx) => {
                      const labelKey = `${fieldPrefix}label_${idx}`;
                      return (
                        <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white/[0.01] border border-white/5 p-3 rounded-2xl relative">
                          <div className="space-y-1 col-span-1 sm:col-span-2">
                            <Label className="text-[9px] uppercase font-bold tracking-widest text-slate-400 flex items-center justify-between">
                              <span>Nome da Gravadora <span className="text-pink-500 font-bold">*</span></span>
                              {labels.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...labels];
                                    updated.splice(idx, 1);
                                    onLabelsChange(updated);
                                  }}
                                  className="text-slate-500 hover:text-rose-500 transition-colors uppercase font-black text-[8px] tracking-wider"
                                >
                                  Remover
                                </button>
                              )}
                            </Label>
                            <Input 
                              value={label.name} 
                              onChange={e => {
                                const updated = [...labels];
                                updated[idx] = { ...updated[idx], name: e.target.value };
                                onLabelsChange(updated);
                              }}
                              placeholder="Nome da Gravadora (Ex: Spinnin, STMPD)"
                              className="rounded-xl bg-white/5 border-white/10 text-white h-10 px-4"
                            />
                          </div>

                          <div className="space-y-2 col-span-1 sm:col-span-2 border-t border-white/5 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <Label className="text-[9px] uppercase font-bold tracking-widest text-slate-400">
                              Logo da Gravadora
                            </Label>
                            <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10 w-fit">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...labels];
                                  updated[idx] = { ...updated[idx], type: 'link' };
                                  onLabelsChange(updated);
                                }}
                                className={cn(
                                  "rounded-lg text-[8px] font-black uppercase tracking-widest h-6 px-2 transition-all cursor-pointer",
                                  (label.type || 'link') === 'link'
                                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                                    : "text-slate-500 hover:text-slate-300"
                                )}
                              >
                                Link / URL
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...labels];
                                  updated[idx] = { ...updated[idx], type: 'file' };
                                  onLabelsChange(updated);
                                }}
                                className={cn(
                                  "rounded-lg text-[8px] font-black uppercase tracking-widest h-6 px-2 transition-all cursor-pointer",
                                  label.type === 'file'
                                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                                    : "text-slate-500 hover:text-slate-300"
                                )}
                              >
                                Enviar Arquivo (.png, .jpg)
                              </button>
                            </div>
                          </div>

                          <div className="col-span-1 sm:col-span-2">
                            {(label.type || 'link') === 'link' ? (
                              <Input 
                                value={label.link} 
                                onChange={e => {
                                  const updated = [...labels];
                                  updated[idx] = { ...updated[idx], link: e.target.value };
                                  onLabelsChange(updated);
                                }}
                                placeholder="Link ou caminho do arquivo"
                                className="rounded-xl bg-white/5 border-white/10 text-white h-10 px-4"
                              />
                            ) : (
                              <div className="relative border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] transition-all rounded-xl p-3 flex flex-col items-center justify-center min-h-[4rem]">
                                {uploadingState[labelKey] ? (
                                  <div className="flex flex-col items-center gap-1.5 w-full max-w-xs py-1">
                                    <div className="flex items-center gap-1.5">
                                      <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                                      <span className="text-[9px] uppercase font-black tracking-widest text-slate-400">
                                        Enviando imagem... {uploadProgress[labelKey] !== undefined ? `${uploadProgress[labelKey]}%` : '0%'}
                                      </span>
                                    </div>
                                    <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden border border-white/5">
                                      <div 
                                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-300" 
                                        style={{ width: `${uploadProgress[labelKey] || 0}%` }}
                                      />
                                    </div>
                                  </div>
                                ) : isUploadedFile(label.link) ? (
                                  <div className="flex flex-col sm:flex-row items-center justify-between w-full bg-purple-950/20 border border-purple-500/20 p-2.5 rounded-xl gap-3">
                                    <div className="flex items-center gap-2.5 w-full sm:w-auto min-w-0">
                                      <div className="w-8 h-8 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                                        <Disc className="w-4 h-4" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[8px] font-black uppercase tracking-wider text-purple-400 mb-0.5">Logo Carregado</p>
                                        <p className="text-xs text-slate-200 font-bold truncate" title={getFriendlyFileName(label.link)}>
                                          {getFriendlyFileName(label.link)}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => {
                                          const updated = [...labels];
                                          updated[idx] = { ...updated[idx], link: '' };
                                          onLabelsChange(updated);
                                        }}
                                        className="h-7 px-2.5 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1 transition-all bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 shadow-none"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                        Apagar
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <label htmlFor={`${labelKey}-file-input`} className="flex flex-col items-center gap-1.5 cursor-pointer w-full h-full py-2 text-center">
                                      <Upload className="w-4 h-4 text-slate-400 hover:text-purple-400 transition-colors" />
                                      <span className="text-[11px] text-slate-300 font-extrabold leading-tight">Escolher Logo da Gravadora</span>
                                      <span className="text-[8px] text-slate-500 font-medium uppercase tracking-wider">PNG, JPG, SVG</span>
                                    </label>
                                    <input
                                      id={`${labelKey}-file-input`}
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => onFileUpload(e, labelKey, ['image/'])}
                                      className="hidden"
                                    />
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onLabelsChange([...labels, { name: '', link: '', type: 'link' }])}
                      className="rounded-xl border-dashed border-white/20 hover:border-purple-500/50 hover:bg-purple-500/10 text-purple-300 text-[9px] font-black uppercase tracking-widest h-9 w-full flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3 h-3" />
                      + Adicionar Outra Gravadora
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3 - Material Visual (Foto Flyer & Vídeo Motion) */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-300">
              3- Material Visual (DJ {djNumber})
            </span>
          </div>
          <Checkbox 
            id={`${fieldPrefix}has-visual-material`} 
            checked={hasVisualMaterial}
            onCheckedChange={(checked) => onHasVisualMaterialChange(checked === true)}
            className="border-slate-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
          />
        </div>

        <AnimatePresence initial={false}>
          {hasVisualMaterial && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 overflow-hidden pt-2"
            >
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                  Tipo de Material Visual a Enviar
                </Label>
                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => onVisualMaterialTypeChange('both')}
                    className={cn(
                      "flex-1 rounded-xl text-[9px] font-black uppercase tracking-widest h-9 transition-all cursor-pointer",
                      (visualMaterialType || 'both') === 'both'
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-inner"
                        : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    Foto + Vídeo
                  </button>
                  <button
                    type="button"
                    onClick={() => onVisualMaterialTypeChange('photo')}
                    className={cn(
                      "flex-1 rounded-xl text-[9px] font-black uppercase tracking-widest h-9 transition-all cursor-pointer",
                      visualMaterialType === 'photo'
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-inner"
                        : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    Apenas Foto
                  </button>
                  <button
                    type="button"
                    onClick={() => onVisualMaterialTypeChange('video')}
                    className={cn(
                      "flex-1 rounded-xl text-[9px] font-black uppercase tracking-widest h-9 transition-all cursor-pointer",
                      visualMaterialType === 'video'
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-inner"
                        : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    Apenas Vídeo
                  </button>
                </div>
              </div>

              {/* Foto Flyer */}
              {(visualMaterialType === 'both' || visualMaterialType === 'photo' || !visualMaterialType) && (
                <div className="space-y-3 border-t border-white/5 pt-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                      <Image className="w-3.5 h-3.5 text-blue-400" />
                      Foto p/ Flyer (DJ {djNumber}) <span className="text-pink-500 font-bold">*</span>
                    </Label>
                    <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10 w-fit">
                      <button
                        type="button"
                        onClick={() => onFlyerPhotoChange('', 'link')}
                        className={cn(
                          "rounded-lg text-[8px] font-black uppercase tracking-widest h-6 px-2.5 transition-all cursor-pointer",
                          (flyerPhotoType || 'link') === 'link'
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                            : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        Link / URL
                      </button>
                      <button
                        type="button"
                        onClick={() => onFlyerPhotoChange('', 'file')}
                        className={cn(
                          "rounded-lg text-[8px] font-black uppercase tracking-widest h-6 px-2.5 transition-all cursor-pointer",
                          flyerPhotoType === 'file'
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                            : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        Enviar Foto
                      </button>
                    </div>
                  </div>

                  {(flyerPhotoType || 'link') === 'link' ? (
                    <Input 
                      value={flyerPhoto || ''} 
                      onChange={e => onFlyerPhotoChange(e.target.value, 'link')} 
                      placeholder="Link direto da imagem em alta resolução" 
                      className="rounded-2xl bg-white/5 border-white/10 text-white h-12" 
                    />
                  ) : (
                    <div className="relative border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] transition-all rounded-2xl p-4 flex flex-col items-center justify-center min-h-[5rem]">
                      {uploadingState[flyerPhotoKey] ? (
                        <div className="flex flex-col items-center gap-2 w-full max-w-xs py-2">
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                              Enviando foto... {uploadProgress[flyerPhotoKey] !== undefined ? `${uploadProgress[flyerPhotoKey]}%` : '0%'}
                            </span>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5 mt-1">
                            <div 
                              className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-300" 
                              style={{ width: `${uploadProgress[flyerPhotoKey] || 0}%` }}
                            />
                          </div>
                        </div>
                      ) : isUploadedFile(flyerPhoto) ? (
                        <div className="flex flex-col sm:flex-row items-center justify-between w-full bg-purple-950/20 border border-purple-500/20 p-4 rounded-2xl gap-4">
                          <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400 shrink-0">
                              <Image className="w-6 h-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-black uppercase tracking-wider text-purple-400 mb-0.5">Foto do Flyer Carregada</p>
                              <p className="text-sm text-slate-200 font-bold truncate" title={getFriendlyFileName(flyerPhoto)}>
                                {getFriendlyFileName(flyerPhoto)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => onFlyerPhotoChange('', 'file')}
                              className="h-9 px-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 shadow-none"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Apagar Foto
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <label htmlFor={`${flyerPhotoKey}-file-input`} className="flex flex-col items-center gap-2 cursor-pointer w-full h-full py-4 text-center">
                            <Upload className="w-6 h-6 text-slate-400 hover:text-purple-400 transition-colors" />
                            <span className="text-xs text-slate-300 font-extrabold max-w-[200px] leading-tight">Escolher Foto (PNG/JPG)</span>
                            <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">Clique para selecionar imagem</span>
                          </label>
                          <input
                            id={`${flyerPhotoKey}-file-input`}
                            type="file"
                            accept="image/*"
                            onChange={(e) => onFileUpload(e, flyerPhotoKey, ['image/'])}
                            className="hidden"
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Vídeo Motion */}
              {(visualMaterialType === 'both' || visualMaterialType === 'video') && (
                <div className="space-y-3 border-t border-white/5 pt-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                      <Film className="w-3.5 h-3.5 text-teal-400" />
                      Vídeo p/ Motion (DJ {djNumber}) <span className="text-pink-500 font-bold">*</span>
                    </Label>
                    <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10 w-fit">
                      <button
                        type="button"
                        onClick={() => onAnimationVideoChange('', 'link')}
                        className={cn(
                          "rounded-lg text-[8px] font-black uppercase tracking-widest h-6 px-2.5 transition-all cursor-pointer",
                          (animationVideoType || 'link') === 'link'
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                            : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        Link / URL
                      </button>
                      <button
                        type="button"
                        onClick={() => onAnimationVideoChange('', 'file')}
                        className={cn(
                          "rounded-lg text-[8px] font-black uppercase tracking-widest h-6 px-2.5 transition-all cursor-pointer",
                          animationVideoType === 'file'
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                            : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        Enviar Vídeo
                      </button>
                    </div>
                  </div>

                  {(animationVideoType || 'link') === 'link' ? (
                    <Input 
                      value={animationVideo || ''} 
                      onChange={e => onAnimationVideoChange(e.target.value, 'link')} 
                      placeholder="Link direto do vídeo de motion" 
                      className="rounded-2xl bg-white/5 border-white/10 text-white h-12" 
                    />
                  ) : (
                    <div className="relative border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] transition-all rounded-2xl p-4 flex flex-col items-center justify-center min-h-[5rem]">
                      {uploadingState[animationVideoKey] ? (
                        <div className="flex flex-col items-center gap-2 w-full max-w-xs py-2">
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                              Enviando vídeo... {uploadProgress[animationVideoKey] !== undefined ? `${uploadProgress[animationVideoKey]}%` : '0%'}
                            </span>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5 mt-1">
                            <div 
                              className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-300" 
                              style={{ width: `${uploadProgress[animationVideoKey] || 0}%` }}
                            />
                          </div>
                        </div>
                      ) : isUploadedFile(animationVideo) ? (
                        <div className="flex flex-col sm:flex-row items-center justify-between w-full bg-purple-950/20 border border-purple-500/20 p-4 rounded-2xl gap-4">
                          <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400 shrink-0">
                              <Film className="w-6 h-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-black uppercase tracking-wider text-purple-400 mb-0.5">Vídeo do Motion Carregado</p>
                              <p className="text-sm text-slate-200 font-bold truncate" title={getFriendlyFileName(animationVideo)}>
                                {getFriendlyFileName(animationVideo)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => onAnimationVideoChange('', 'file')}
                              className="h-9 px-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 shadow-none"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Apagar Vídeo
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <label htmlFor={`${animationVideoKey}-file-input`} className="flex flex-col items-center gap-2 cursor-pointer w-full h-full py-4 text-center">
                            <Upload className="w-6 h-6 text-slate-400 hover:text-purple-400 transition-colors" />
                            <span className="text-xs text-slate-300 font-extrabold max-w-[200px] leading-tight">Escolher Vídeo (MP4/MOV)</span>
                            <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">Clique para selecionar arquivo de vídeo</span>
                          </label>
                          <input
                            id={`${animationVideoKey}-file-input`}
                            type="file"
                            accept="video/*"
                            onChange={(e) => onFileUpload(e, animationVideoKey, ['video/'])}
                            className="hidden"
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4 - Escolher Track / Trilha de Entrada */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-pink-400" />
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-300">
              4- Escolher Track (DJ {djNumber})
            </span>
          </div>
          <Checkbox 
            id={`${fieldPrefix}has-playlist`} 
            checked={hasPlaylist}
            onCheckedChange={(checked) => onHasPlaylistChange(checked === true)}
            className="border-slate-500 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
          />
        </div>

        <AnimatePresence initial={false}>
          {hasPlaylist && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 overflow-hidden pt-2"
            >
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                  Nome da Música (DJ {djNumber}) <span className="text-pink-500 font-bold">*</span>
                </Label>
                <Input 
                  value={musicName || ''} 
                  onChange={e => onMusicNameChange(e.target.value)} 
                  placeholder="Ex: Hear Me Now" 
                  className="rounded-2xl bg-white/5 border-white/10 text-white h-12" 
                />
              </div>

              <div className="space-y-4 border-t border-white/5 pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                    Link ou Arquivo da Música
                  </Label>
                  <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10 w-fit">
                    <button
                      type="button"
                      onClick={() => {
                        onMusicTypeChange('link');
                        setDurationMode('time');
                      }}
                      className={cn(
                        "rounded-lg text-[8px] font-black uppercase tracking-widest h-7 px-2.5 transition-all cursor-pointer",
                        (musicUrlType || 'link') === 'link'
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                          : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      Link / URL
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onMusicTypeChange('file');
                        setDurationMode('visual');
                      }}
                      className={cn(
                        "rounded-lg text-[8px] font-black uppercase tracking-widest h-7 px-2.5 transition-all cursor-pointer",
                        musicUrlType === 'file'
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-inner"
                          : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      Enviar Áudio (.mp3, .wav)
                    </button>
                  </div>
                </div>

                {(musicUrlType || 'link') === 'link' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                        Link da Música (Spotify/Youtube)
                      </Label>
                      <Input 
                        value={musicUrl || ''} 
                        onChange={e => onMusicNameChange(e.target.value)} 
                        placeholder="Ex: Link do Spotify/Youtube" 
                        className="rounded-2xl bg-white/5 border-white/10 text-white h-12" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                        Duração / Minutos de Corte
                      </Label>
                      <Input 
                        value={musicDuration || ''} 
                        onChange={e => onMusicDurationChange(e.target.value)} 
                        placeholder="Ex: 01:20" 
                        className="rounded-2xl bg-white/5 border-white/10 text-white h-12" 
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] transition-all rounded-2xl p-4 flex flex-col items-center justify-center min-h-[5rem]">
                      {uploadingState[musicKey] ? (
                        <div className="flex flex-col items-center gap-2 w-full max-w-xs py-2">
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                              Enviando música... {uploadProgress[musicKey] !== undefined ? `${uploadProgress[musicKey]}%` : '0%'}
                            </span>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5 mt-1">
                            <div 
                              className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-300" 
                              style={{ width: `${uploadProgress[musicKey] || 0}%` }}
                            />
                          </div>
                        </div>
                      ) : (isUploadedFile(musicUrl) || !!localMusicBlobUrl) ? (
                        <div className="flex flex-col sm:flex-row items-center justify-between w-full bg-purple-950/20 border border-purple-500/20 p-4 rounded-2xl gap-4">
                          <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400 shrink-0">
                              <Music className="w-6 h-6 animate-pulse" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-black uppercase tracking-wider text-purple-400 mb-0.5">Áudio da Música Carregado</p>
                              <p className="text-sm text-slate-200 font-bold truncate" title={getFriendlyFileName(musicUrl || localMusicBlobUrl || undefined)}>
                                {getFriendlyFileName(musicUrl || localMusicBlobUrl || undefined)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={onClearMusic}
                              className="h-9 px-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 shadow-none"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Apagar Música
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <label htmlFor={`${musicKey}-file-input`} className="flex flex-col items-center gap-2 cursor-pointer w-full h-full py-4 text-center">
                            <Upload className="w-6 h-6 text-slate-400 hover:text-purple-400 transition-colors" />
                            <span className="text-xs text-slate-300 font-extrabold max-w-[200px] leading-tight">Escolher Música (MP3/WAV)</span>
                            <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wider font-mono">Clique para selecionar áudio</span>
                          </label>
                          <input
                            id={`${musicKey}-file-input`}
                            type="file"
                            accept="audio/*"
                            onChange={(e) => onFileUpload(e, musicKey, ['.mp3', '.wav', '.flac', '.m4a', 'audio/'])}
                            className="hidden"
                          />
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-3">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                          Como definir o tempo do Drop?
                        </Label>
                        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 w-full">
                          <button
                            type="button"
                            onClick={() => setDurationMode('visual')}
                            className={cn(
                              "flex-1 rounded-lg text-[9px] font-black uppercase tracking-widest h-8 transition-all cursor-pointer",
                              durationMode === 'visual'
                                ? "bg-pink-500 text-white shadow-md font-bold"
                                : "text-slate-400 hover:text-slate-200"
                            )}
                          >
                            1: Escolher Visualmente
                          </button>
                          <button
                            type="button"
                            onClick={() => setDurationMode('time')}
                            className={cn(
                              "flex-1 rounded-lg text-[9px] font-black uppercase tracking-widest h-8 transition-all cursor-pointer",
                              durationMode === 'time'
                                ? "bg-pink-500 text-white shadow-md font-bold"
                                : "text-slate-400 hover:text-slate-200"
                            )}
                          >
                            2: Inserir Tempo (Minutos)
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                          {durationMode === 'visual' ? 'Corte Selecionado' : 'Tempo Exato'}
                        </Label>
                        {durationMode === 'visual' ? (
                          <Button
                            type="button"
                            onClick={onOpenWaveform}
                            disabled={!musicUrl && !localMusicBlobUrl}
                            className="w-full h-12 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border-none shadow-[0_0_20px_rgba(236,72,153,0.3)] disabled:opacity-50"
                          >
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            {musicDuration ? `Corte: ${musicDuration} (Alterar)` : 'Abrir Waveform e Marcar Drop'}
                          </Button>
                        ) : (
                          <Input
                            value={musicDuration || ''}
                            onChange={e => onMusicDurationChange(e.target.value)}
                            placeholder="Ex: 01:25 ou 01:25 - 01:45"
                            className="rounded-2xl bg-white/5 border-white/10 text-white h-12"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
