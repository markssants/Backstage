import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { DjAsset } from '../../types';
import { WaveformSelector } from './WaveformSelector';
import { getDriveAccessToken, getGoogleDriveFileId } from '../../lib/googleDrive';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Disc, 
  Music, 
  Calendar, 
  BadgeCheck, 
  ExternalLink, 
  Loader2, 
  Image, 
  Film, 
  CheckCircle2,
  Lock,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Plus,
  Trash2,
  ShieldAlert,
  Upload,
  Paperclip
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface DjPublicFormProps {
  eventId: string;
  assetId: string;
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

async function loadStoredAudioAsBlob(url: string | undefined, setBlobUrl: (u: string | null) => void) {
  if (!url) return;
  const fileId = getGoogleDriveFileId(url);
  if (!fileId) return;

  try {
    const accessToken = await getDriveAccessToken();
    if (accessToken) {
      const gdriveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const response = await fetch(gdriveUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      if (response.ok) {
        const blob = await response.blob();
        const localBlobUrl = URL.createObjectURL(blob);
        setBlobUrl(localBlobUrl);
      } else {
        console.warn("Could not fetch file content from Google Drive API:", response.statusText);
      }
    }
  } catch (err) {
    console.error("Error loading stored audio as blob:", err);
  }
}

export function DjPublicForm({ eventId, assetId }: DjPublicFormProps) {
  const [asset, setAsset] = useState<DjAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form states
  const [presskitUrl, setPresskitUrl] = useState('');
  const [hasVisualMaterial, setHasVisualMaterial] = useState(false);
  const [flyerPhoto, setFlyerPhoto] = useState('');
  const [animationVideo, setAnimationVideo] = useState('');
  
  const [hasPlaylist, setHasPlaylist] = useState(false);
  const [musicName, setMusicName] = useState('');
  const [musicUrl, setMusicUrl] = useState('');
  const [musicDuration, setMusicDuration] = useState('');
  const [musicUrlType, setMusicUrlType] = useState<'link' | 'file'>('link');
  const [uploadingState, setUploadingState] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [durationMode, setDurationMode] = useState<'time' | 'visual'>('time');
  const [isWaveformOpen, setIsWaveformOpen] = useState(false);
  const [localMusicBlobUrl, setLocalMusicBlobUrl] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldKey: string, allowedTypes: string[], maxSizeMB = 50) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!storage) {
      toast.error("O serviço de upload direto não está configurado.");
      return;
    }

    // Validate size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      toast.error(`O arquivo excede o limite de tamanho de ${maxSizeMB}MB.`);
      return;
    }

    // Validate type
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    const matchType = allowedTypes.length === 0 || allowedTypes.some(t => {
      if (t.startsWith('.')) {
        return fileExt === t;
      }
      return file.type.includes(t);
    });

    if (!matchType) {
      toast.error(`Tipo de arquivo não permitido. Por favor envie um arquivo do tipo: ${allowedTypes.join(', ')}`);
      return;
    }

    if (fieldKey === 'musicUrl') {
      try {
        const localUrl = URL.createObjectURL(file);
        setLocalMusicBlobUrl(localUrl);
      } catch (err) {
        console.error("Erro ao criar URL do blob local:", err);
      }
    }

    setUploadingState(prev => ({ ...prev, [fieldKey]: true }));
    setUploadProgress(prev => ({ ...prev, [fieldKey]: 0 }));

    // Upload directly to Firebase Storage
    try {
      const refinedFileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const storagePath = `events/${eventId}/dj_assets/${refinedFileName}`;
      const fileRef = ref(storage, storagePath);
      
      const uploadTask = uploadBytesResumable(fileRef, file);
      const downloadUrl = await new Promise<string>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setUploadProgress(prev => ({ ...prev, [fieldKey]: progress }));
          },
          (error) => {
            reject(error);
          },
          async () => {
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            } catch (err) {
              reject(err);
            }
          }
        );
      });
      
      if (fieldKey === 'musicUrl') {
        setMusicUrl(downloadUrl);
        setMusicUrlType('file');
        setMusicName(curr => curr || file.name.replace(/\.[^/.]+$/, ""));
        setDurationMode('visual'); // Switch to visual on successful upload!
        toast.success("Música enviada com sucesso!");
      }
    } catch (err: any) {
      console.warn("Firebase Storage failed, attempting local server upload fallback...", err);

      // Fallback 2: Local Node dev server upload
      try {
        const downloadUrl = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `/api/upload?filename=${encodeURIComponent(file.name)}`);
          
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(prev => ({ ...prev, [fieldKey]: progress }));
            }
          });

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                resolve(data.url);
              } catch (e) {
                reject(new Error("Invalid JSON response from server"));
              }
            } else {
              reject(new Error(`Server returned status ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error("Network error"));
          xhr.send(file);
        });

        if (fieldKey === 'musicUrl') {
          setMusicUrl(downloadUrl);
          setMusicUrlType('file');
          setMusicName(curr => curr || file.name.replace(/\.[^/.]+$/, ""));
          setDurationMode('visual');
          toast.success("Música enviada via servidor local!");
        }
      } catch (fallbackErr: any) {
        console.error("Todos os envios falharam:", fallbackErr);
        toast.custom((t) => (
          <div className="bg-slate-900 border border-red-500/30 p-4 rounded-xl text-white max-w-sm shadow-xl font-sans text-xs">
            <p className="font-bold text-red-400 mb-1">⚠️ Envio de Arquivo Indisponível</p>
            <p className="text-slate-300 leading-normal mb-1">
              O upload para o Firebase Storage e servidor local falharam.
            </p>
            <p className="text-purple-400 leading-normal">
              <strong>Alternativa Rápida:</strong> Clique em <b>"Colar Link / URL"</b> acima e insira um link direto do Drive, Dropbox, Soundcloud ou Youtube!
            </p>
          </div>
        ), { duration: 10000 });
      }
    } finally {
      setUploadingState(prev => ({ ...prev, [fieldKey]: false }));
    }
  };

  // Logo info (Now editable by DJ)
  const [hasMandatoryLogo, setHasMandatoryLogo] = useState(false);
  const [agencies, setAgencies] = useState<{ name: string; link: string }[]>([]);
  const [labels, setLabels] = useState<{ name: string; link: string }[]>([]);
  const [hasRecordLabel, setHasRecordLabel] = useState(false);

  useEffect(() => {
    async function fetchDjAsset() {
      try {
        const docRef = doc(db, 'events', eventId, 'dj_assets', assetId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as DjAsset;
          setAsset(data);
          
          // Populate fields
          setPresskitUrl(data.presskitUrl || '');
          setFlyerPhoto(data.flyerPhoto || '');
          setAnimationVideo(data.animationVideo || '');
          setMusicName(data.musicName || '');
          setMusicUrl(data.musicUrl || '');
          setMusicDuration(data.musicDuration || '');
          
          const isFile = isUploadedFile(data.musicUrl);
          setMusicUrlType(data.musicUrlType || (isFile ? 'file' : 'link'));
          setDurationMode(isFile ? 'visual' : 'time');

          setHasVisualMaterial(!!(data.flyerPhoto || data.animationVideo));
          setHasPlaylist(!!(data.musicName || data.musicUrl || data.musicDuration));
          
          setHasMandatoryLogo(!!data.hasMandatoryLogo);
          setAgencies(data.agencies && data.agencies.length > 0 ? data.agencies : [{ name: '', link: '' }]);
          setLabels(data.labels && data.labels.length > 0 ? data.labels : [{ name: '', link: '' }]);
          setHasRecordLabel(!!(data.labels && data.labels.length > 0 && data.labels.some(l => l.name?.trim() || l.link?.trim())));
          
          if (data.musicUrl && (data.musicUrlType === 'file' || isFile)) {
            loadStoredAudioAsBlob(data.musicUrl, setLocalMusicBlobUrl);
          }
        } else {
          toast.error('DJ ou Atração não encontrada.');
        }
      } catch (err) {
        console.error('Erro ao buscar DJ asset:', err);
        toast.error('Não foi possível carregar o formulário. Por favor, verifique o link.');
      } finally {
        setLoading(false);
      }
    }

    fetchDjAsset();
  }, [eventId, assetId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!presskitUrl.trim()) {
      toast.error("O link do seu Presskit é obrigatório.");
      return;
    }

    if (hasVisualMaterial && asset) {
      const vProps = asset.visualMaterialType || 'both';
      if (vProps === 'both' || vProps === 'photo') {
        if (!flyerPhoto.trim()) {
          toast.error("Por favor, preencha a foto para o Flyer.");
          return;
        }
      }
      if (vProps === 'both' || vProps === 'video') {
        if (!animationVideo.trim()) {
          toast.error("Por favor, preencha o vídeo para Animação/Motion.");
          return;
        }
      }
    }

    if (hasPlaylist) {
      if (!musicName.trim()) {
        toast.error("Por favor, preencha o nome da música.");
        return;
      }
    }

    if (hasMandatoryLogo) {
      if (agencies.length === 0) {
        toast.error("Por favor, adicione pelo menos uma Agência de Booking.");
        return;
      }
      for (let i = 0; i < agencies.length; i++) {
        const agency = agencies[i];
        if (!agency.name.trim()) {
          toast.error(`O nome da Agência #${i + 1} é obrigatório.`);
          return;
        }
        if (!agency.link.trim()) {
          toast.error(`O link do logo da Agência "${agency.name}" é obrigatório.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const docRef = doc(db, 'events', eventId, 'dj_assets', assetId);
      
      const vProps = asset?.visualMaterialType || 'both';
      const updateData: Partial<DjAsset> = {
        presskitUrl: presskitUrl.trim(),
        flyerPhoto: hasVisualMaterial && (vProps === 'both' || vProps === 'photo') ? flyerPhoto.trim() : '',
        animationVideo: hasVisualMaterial && (vProps === 'both' || vProps === 'video') ? animationVideo.trim() : '',
        musicName: hasPlaylist ? musicName.trim() : '',
        musicUrl: hasPlaylist ? musicUrl.trim() : '',
        musicDuration: hasPlaylist ? musicDuration.trim() : '',
        musicUrlType: hasPlaylist ? musicUrlType : 'link',
        presskitStatus: 'completed',
        hasMandatoryLogo: hasMandatoryLogo,
        agencies: hasMandatoryLogo ? agencies.filter(a => a.name.trim() !== '') : [],
        labels: (hasMandatoryLogo && hasRecordLabel) ? labels.filter(l => l.name.trim() !== '') : [],
        agencyInfo: hasMandatoryLogo ? agencies.filter(a => a.name.trim() !== '').map(a => `${a.name} (${a.link})`).join(', ') : '',
        labelInfo: (hasMandatoryLogo && hasRecordLabel) ? labels.filter(l => l.name.trim() !== '').map(l => `${l.name} (${l.link})`).join(', ') : '',
      };

      await updateDoc(docRef, updateData);
      setSuccess(true);
      toast.success('Informações atualizadas com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar dados do DJ:', err);
      toast.error('Erro ao salvar as informações. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0518] text-white">
        <Loader2 className="w-10 h-10 animate-spin text-pink-500 mb-4" />
        <p className="text-sm font-black uppercase tracking-widest text-slate-400">Carregando Formulário do DJ...</p>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0518] text-white px-4">
        <div className="text-center space-y-4 max-w-sm glass-card p-10 rounded-3xl border-rose-500/20">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-white">Link Inválido</h2>
          <p className="text-slate-400 text-sm">Esta atração ou DJ não foi encontrado no sistema ou o link está quebrado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0518] text-slate-100 flex flex-col items-center py-6 sm:py-12 px-4 relative overflow-y-auto">
      {/* Glow Effects */}
      <div className="glow-purple top-[-10%] left-[-10%] w-[50%] h-[50%] opacity-50" />
      <div className="glow-pink bottom-[10%] right-[-5%] w-[45%] h-[45%] opacity-40" />

      <div className="max-w-2xl w-full relative z-10 space-y-6 sm:space-y-8">
        
        {/* Header decoration */}
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <Disc className="text-white w-5 h-5 animate-spin-slow" />
          </div>
          <span className="text-xs font-black uppercase tracking-[0.4em] text-pink-500">BACKSTAGE CLIENT</span>
        </div>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div 
              key="success-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-6 sm:p-10 rounded-3xl sm:rounded-[2.5rem] border-emerald-500/20 text-center space-y-6"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Tudo Pronto, {asset.name}!</h2>
                <p className="text-slate-400 text-sm sm:text-base max-w-md mx-auto">
                  Suas mídias, presskit e trilha de entrada foram salvos e integrados diretamente no cronograma de produção do painel.
                </p>
              </div>

              <div className="pt-6 border-t border-white/5 flex justify-center">
                <Button 
                  onClick={() => setSuccess(false)}
                  className="rounded-2xl h-11 sm:h-12 bg-white/5 hover:bg-white/10 text-slate-300 font-bold px-6 sm:px-8 uppercase tracking-widest text-[9px] sm:text-[10px]"
                >
                  Editar Informações Novamente
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="form-card"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="glass-card rounded-3xl sm:rounded-[2.5rem] border-white/5 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            >
              {/* Context bar */}
              <div className="bg-gradient-to-r from-purple-900/40 via-pink-900/20 to-transparent p-5 sm:p-8 border-b border-white/5">
                <div className="flex items-center gap-1.5 text-xs text-pink-400 font-black uppercase tracking-widest mb-1">
                  <Sparkles className="w-3.5 h-3.5" /> Ficha Presskit
                </div>
                <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white mb-2">{asset.name}</h1>
                <p className="text-slate-400 text-xs sm:text-sm max-w-xl leading-relaxed">
                  Insira seus links e arquivos abaixo para a produção e assessoria do evento. Você pode editar estas informações a qualquer momento usando este mesmo link.
                </p>

                {/* Deadline & details tags */}
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {asset.artDeadline && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-pink-500/10 border border-pink-500/20 text-pink-400 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                      <Calendar className="w-3 h-3" />
                      Prazo: {asset.artDeadline}
                    </div>
                  )}
                  {asset.hasMandatoryLogo && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                      <ShieldCheck className="w-3 h-3" />
                      Logos Obrigatórios
                    </div>
                  )}
                </div>
              </div>

              {/* Form entries */}
              <form onSubmit={handleSave} className="p-5 sm:p-8 space-y-6 sm:space-y-8">
                
                {/* 1 - Link do Presskit */}
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <Label className="text-[11px] uppercase font-black tracking-widest text-slate-300 flex items-center gap-1.5 cursor-pointer">
                      <span className="w-5 h-5 rounded bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-[9px] shrink-0">1</span>
                      <span className="leading-normal">Link do seu Presskit <span className="text-pink-500 font-bold">*</span></span>
                    </Label>
                    {presskitUrl && (
                      <a href={presskitUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-pink-400 hover:text-pink-300 font-bold flex items-center gap-1 self-start sm:self-auto pl-6 sm:pl-0">
                        Ver Link <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <Input 
                    required
                    value={presskitUrl} 
                    onChange={e => setPresskitUrl(e.target.value)} 
                    placeholder="Cole aqui o link do seu GDrive, Dropbox, Linktree ou Direct.me" 
                    className="rounded-2xl bg-white/5 border-white/10 text-white h-11 sm:h-12 text-sm focus:border-pink-500"
                  />
                  <p className="text-[10px] sm:text-[11px] text-slate-500 leading-relaxed italic">
                    Forneça o link de uma pasta compartilhada contendo suas fotos oficiais em alta resolução, release e logos da assessoria.
                  </p>
                </div>

                {/* 2 - Logos Obrigatórios (Agências e Gravadoras) */}
                <div className="border-t border-white/5 pt-6 space-y-4">
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    <Label className="text-[11px] uppercase font-black tracking-widest text-slate-300 flex items-center gap-1.5 cursor-pointer select-none" htmlFor="public-has-mandatory-logo">
                      <span className="w-5 h-5 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[9px] shrink-0">2</span>
                      <span className="leading-normal">Possui Logos Obrigatórios (Agências e Gravadoras)</span>
                    </Label>
                    <Checkbox 
                      id="public-has-mandatory-logo" 
                      checked={hasMandatoryLogo}
                      onCheckedChange={(checked) => {
                        const isChecked = checked === true;
                        setHasMandatoryLogo(isChecked);
                        if (isChecked && agencies.length === 0) {
                          setAgencies([{ name: '', link: '' }]);
                        }
                      }}
                      className="border-slate-500 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 shrink-0 mt-0.5 sm:mt-0"
                    />
                  </div>

                  <AnimatePresence initial={false}>
                    {hasMandatoryLogo && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-5 overflow-hidden pt-2"
                      >
                        {/* Agências */}
                        <div className="space-y-3">
                          <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                            Agência / Bookings Obrigatória(s)
                          </Label>
                          
                          <div className="space-y-3">
                            {agencies.map((agency, idx) => (
                              <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white/[0.01] border border-white/5 p-3 rounded-2xl relative">
                                <div className="space-y-1">
                                  <Label className="text-[9px] uppercase font-bold tracking-widest text-slate-400 flex items-center justify-between">
                                    <span>Nome da Agência <span className="text-pink-500 font-bold">*</span></span>
                                    {agencies.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = [...agencies];
                                          updated.splice(idx, 1);
                                          setAgencies(updated);
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
                                      setAgencies(updated);
                                    }}
                                    placeholder="Nome da Agência"
                                    className="rounded-xl bg-white/5 border-white/10 text-white h-10 px-4 text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] uppercase font-bold tracking-widest text-slate-400">
                                    Link do Logo <span className="text-pink-500 font-bold">*</span>
                                  </Label>
                                  <Input 
                                    value={agency.link} 
                                    onChange={e => {
                                      const updated = [...agencies];
                                      updated[idx] = { ...updated[idx], link: e.target.value };
                                      setAgencies(updated);
                                    }}
                                    placeholder="Link do drive ou site"
                                    className="rounded-xl bg-white/5 border-white/10 text-white h-10 px-4 text-sm"
                                  />
                                </div>
                              </div>
                            ))}
                            
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              onClick={() => {
                                setAgencies([...agencies, { name: '', link: '' }]);
                              }}
                              className="w-full rounded-xl h-10 border-dashed border-white/10 hover:bg-white/5 font-black text-slate-400 uppercase tracking-widest text-[9px] flex items-center justify-center gap-1 bg-none"
                            >
                              <Plus className="w-3.5 h-3.5 text-amber-500" />
                              Adicionar Outra Agência
                            </Button>
                          </div>
                        </div>

                        {/* Gravadora Checkbox */}
                        <div className="flex items-center gap-2 pt-2">
                          <Checkbox 
                            id="public-has-record-label" 
                            checked={hasRecordLabel}
                            onCheckedChange={(checked) => {
                              const isChecked = checked === true;
                              setHasRecordLabel(isChecked);
                              if (isChecked && labels.length === 0) {
                                setLabels([{ name: '', link: '' }]);
                              }
                            }}
                            className="border-slate-500 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                          />
                          <Label htmlFor="public-has-record-label" className="text-[10px] uppercase font-black tracking-widest text-slate-300 cursor-pointer">
                            Inserir Gravadora / Label Obrigatória
                          </Label>
                        </div>

                        {/* Gravadora */}
                        <AnimatePresence initial={false}>
                          {hasRecordLabel && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.15 }}
                              className="space-y-3 overflow-hidden pt-1"
                            >
                              <div className="space-y-3">
                                {labels.map((label, idx) => (
                                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white/[0.01] border border-white/5 p-3 rounded-2xl relative">
                                    <div className="space-y-1">
                                      <Label className="text-[9px] uppercase font-bold tracking-widest text-slate-400 flex items-center justify-between">
                                        <span>Nome da Gravadora <span className="text-pink-500 font-bold">*</span></span>
                                        {labels.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updated = [...labels];
                                              updated.splice(idx, 1);
                                              setLabels(updated);
                                            }}
                                            className="text-slate-400 hover:text-rose-500 transition-colors uppercase font-black text-[8px] tracking-wider"
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
                                          setLabels(updated);
                                        }}
                                        placeholder="Ex: Spinnin Records"
                                        className="rounded-xl bg-white/5 border-white/10 text-white h-10 px-4 text-sm"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[9px] uppercase font-bold tracking-widest text-slate-400">
                                        Link do Logo (Opcional)
                                      </Label>
                                      <Input 
                                        value={label.link} 
                                        onChange={e => {
                                          const updated = [...labels];
                                          updated[idx] = { ...updated[idx], link: e.target.value };
                                          setLabels(updated);
                                        }}
                                        placeholder="Link do drive ou site"
                                        className="rounded-xl bg-white/5 border-white/10 text-white h-10 px-4 text-sm"
                                      />
                                    </div>
                                  </div>
                                ))}

                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => {
                                    setLabels([...labels, { name: '', link: '' }]);
                                  }}
                                  className="w-full rounded-xl h-10 border-dashed border-white/10 hover:bg-white/5 font-black text-slate-400 uppercase tracking-widest text-[9px] flex items-center justify-center gap-1 bg-none"
                                >
                                  <Plus className="w-3.5 h-3.5 text-amber-500" />
                                  Adicionar Outra Gravadora
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 3 - Imagem de Apoio & Motion */}
                <div className="border-t border-white/5 pt-6 space-y-4">
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    <Label className="text-[11px] uppercase font-black tracking-widest text-slate-300 flex items-center gap-1.5 cursor-pointer select-none" htmlFor="public-has-visual-material">
                      <span className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[9px] shrink-0">3</span>
                      <span className="leading-normal">
                        {(() => {
                          const vProps = asset?.visualMaterialType || 'both';
                          if (vProps === 'photo') return 'Escolher apenas Foto';
                          if (vProps === 'video') return 'Escolher apenas Vídeo';
                          return 'Escolher Foto e Vídeo Específica';
                        })()}
                      </span>
                    </Label>
                    <Checkbox 
                      id="public-has-visual-material" 
                      checked={hasVisualMaterial}
                      onCheckedChange={(checked) => setHasVisualMaterial(checked === true)}
                      className="border-slate-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 shrink-0 mt-0.5 sm:mt-0"
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
                        {/* Only show Foto if visualMaterialType is 'photo' or 'both' */}
                        {(() => {
                          const vProps = asset?.visualMaterialType || 'both';
                          return (vProps === 'photo' || vProps === 'both') && (
                            <div className="space-y-2">
                              <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                                Foto para o Flyer (Ex: Nome do arquivo no Drive ou Link do Drive) <span className="text-pink-500 font-bold">*</span>
                              </Label>
                              <Input value={flyerPhoto} onChange={e => setFlyerPhoto(e.target.value)} placeholder="Ex: foto_oficial_pink.png ou link da foto" className="rounded-2xl bg-white/5 border-white/10 text-white h-11 sm:h-12 text-sm" />
                            </div>
                          );
                        })()}

                        {/* Only show Video if visualMaterialType is 'video' or 'both' */}
                        {(() => {
                          const vProps = asset?.visualMaterialType || 'both';
                          return (vProps === 'video' || vProps === 'both') && (
                            <div className="space-y-2">
                              <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                                Vídeo para Animação / Painel (Nome do arquivo no Drive ou Link do GDrive) <span className="text-pink-500 font-bold">*</span>
                              </Label>
                              <Input value={animationVideo} onChange={e => setAnimationVideo(e.target.value)} placeholder="Ex: painel_loop_dj.mp4 ou link do drive" className="rounded-2xl bg-white/5 border-white/10 text-white h-11 sm:h-12 text-sm" />
                            </div>
                          );
                        })()}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 4 - Música de Entrada */}
                <div className="border-t border-white/5 pt-6 space-y-5">
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    <Label className="text-[11px] uppercase font-black tracking-widest text-slate-300 flex items-center gap-1.5 cursor-pointer select-none" htmlFor="public-has-playlist">
                      <span className="w-5 h-5 rounded bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-[9px] shrink-0">4</span>
                      <span className="leading-normal">Escolher Track Especifica</span>
                    </Label>
                    <Checkbox 
                      id="public-has-playlist" 
                      checked={hasPlaylist}
                      onCheckedChange={(checked) => setHasPlaylist(checked === true)}
                      className="border-slate-500 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500 shrink-0 mt-0.5 sm:mt-0"
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
                            Nome da Música / Track <span className="text-pink-500 font-bold">*</span>
                          </Label>
                          <Input value={musicName} onChange={e => setMusicName(e.target.value)} placeholder="Ex: Hear Me Now ou Out of Control" className="rounded-2xl bg-white/5 border-white/10 text-white h-11 sm:h-12 text-sm" />
                        </div>

                        <div className="space-y-3">
                          <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                            Origem da Música
                          </Label>
                          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 w-full sm:w-fit">
                            <button
                              type="button"
                              onClick={() => {
                                setMusicUrlType('link');
                                if (durationMode === 'visual') {
                                  setDurationMode('time');
                                }
                              }}
                              className={cn(
                                "flex-1 sm:flex-initial rounded-lg text-[9px] font-black uppercase tracking-widest h-8 px-4 transition-all cursor-pointer",
                                musicUrlType === 'link'
                                  ? "bg-purple-500 text-white shadow-md font-bold"
                                  : "text-slate-500 hover:text-slate-300"
                              )}
                            >
                              Colar Link / URL
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMusicUrlType('file');
                                setDurationMode('visual');
                              }}
                              className={cn(
                                "flex-1 sm:flex-initial rounded-lg text-[9px] font-black uppercase tracking-widest h-8 px-4 transition-all cursor-pointer",
                                musicUrlType === 'file'
                                  ? "bg-purple-500 text-white shadow-md font-bold"
                                  : "text-slate-500 hover:text-slate-300"
                              )}
                            >
                              Enviar Áudio (.mp3, .wav)
                            </button>
                          </div>
                        </div>

                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-3 flex.col sm:flex-row gap-2.5 items-start">
                          <div className="flex gap-2 items-center">
                            <Sparkles className="w-4 h-4 text-pink-400 shrink-0" />
                            <p className="text-[10px] font-black uppercase tracking-wider text-pink-400">
                              Novidade: Seleção Visual por Waveform Ativa! 🎧
                            </p>
                          </div>
                          <p className="text-[10px] text-slate-300 leading-relaxed mt-1">
                            Selecione a opção <strong className="text-white">"Enviar Áudio (.mp3, .wav)"</strong> e faça o upload direto do seu som para desbloquear o <strong>Corte Visual por Waveform</strong>. Você conseguirá ver o espectro de som da música, dar play e arrastar para pinçar o momento cirúrgico no qual o Drop deve acontecer!
                          </p>
                        </div>

                        {musicUrlType === 'link' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                                Link da Música (Spotify, Youtube, etc)
                              </Label>
                              <Input value={musicUrl} onChange={e => setMusicUrl(e.target.value)} placeholder="Ex: link do Spotify, Youtube, SoundCloud..." className="rounded-2xl bg-white/5 border-white/10 text-white h-11 sm:h-12 text-sm" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                                Melhor Minuto / Duração para Corte (tempo)
                              </Label>
                              <Input value={musicDuration} onChange={e => setMusicDuration(e.target.value)} placeholder="Ex: De 01:20 a 01:45" className="rounded-2xl bg-white/5 border-white/10 text-white h-11 sm:h-12 text-sm" />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="relative border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] transition-all rounded-2xl p-4 flex flex-col items-center justify-center min-h-[5rem]">
                              {uploadingState['musicUrl'] ? (
                                <div className="flex flex-col items-center gap-2 w-full max-w-xs py-2">
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                                      Enviando música... {uploadProgress['musicUrl'] !== undefined ? `${uploadProgress['musicUrl']}%` : '0%'}
                                    </span>
                                  </div>
                                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5 mt-1">
                                    <div 
                                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-300" 
                                      style={{ width: `${uploadProgress['musicUrl'] || 0}%` }}
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
                                      <p className="text-[10px] font-black uppercase tracking-wider text-purple-400 mb-0.5">Áudio Carregado</p>
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
                                      onClick={() => {
                                        setMusicUrl('');
                                        setLocalMusicBlobUrl(null);
                                        setDurationMode('time');
                                        toast.success("Música removida! Você pode escolher outro arquivo.");
                                      }}
                                      className="h-9 px-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 shadow-none"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Apagar Música
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <label htmlFor="public-music-file-input" className="flex flex-col items-center gap-2 cursor-pointer w-full h-full py-4 text-center">
                                    <Upload className="w-6 h-6 text-slate-400 hover:text-purple-400 transition-colors" />
                                    <span className="text-xs text-slate-300 font-extrabold max-w-[200px] leading-tight">Escolher Música (MP3/WAV)</span>
                                    <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wider font-mono">Clique para selecionar áudio</span>
                                  </label>
                                  <input
                                    id="public-music-file-input"
                                    type="file"
                                    accept="audio/*"
                                    onChange={(e) => handleFileUpload(e, 'musicUrl', ['.mp3', '.wav', '.flac', '.m4a', 'audio/'])}
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
                                    onClick={() => {
                                      if (isUploadedFile(musicUrl) || !!localMusicBlobUrl) {
                                        setDurationMode('visual');
                                      } else {
                                        toast.warning("Envie o arquivo de áudio (.mp3/wav) primeiro para habilitar a escolha visual!");
                                      }
                                    }}
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
                                        ? "bg-purple-500 text-white shadow-md font-bold"
                                        : "text-slate-400 hover:text-slate-200"
                                    )}
                                  >
                                    2: Escolher pelo Tempo
                                  </button>
                                </div>
                              </div>

                              {(durationMode === 'visual' && (isUploadedFile(musicUrl) || !!localMusicBlobUrl)) ? (
                                <div className="space-y-2">
                                  <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                                    Corte / Drop Escolhido
                                  </Label>
                                  <div className="flex items-center gap-2">
                                    <Input 
                                      readOnly 
                                      value={musicDuration || 'Não marcado'} 
                                      className="rounded-2xl bg-white/5 border-white/10 text-white h-12 font-mono font-bold w-[120px] text-center" 
                                      id="public-music-duration"
                                    />
                                    <Button
                                      id="public-btn-waveform-toggle"
                                      type="button"
                                      onClick={() => setIsWaveformOpen(!isWaveformOpen)}
                                      className="flex-1 bg-pink-500 hover:bg-pink-600 text-white rounded-2xl h-11 sm:h-12 font-extrabold uppercase tracking-wider text-[9px] flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(236,72,153,0.15)] transition-all"
                                    >
                                      <Music className="w-3.5 h-3.5" />
                                      {isWaveformOpen ? "Fechar Ajuste" : musicDuration ? "Ajustar Drop" : "Marcar Drop Visualmente"}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                                    Melhor Minuto / Duração para Corte (tempo)
                                  </Label>
                                  <Input 
                                    value={musicDuration} 
                                    onChange={e => setMusicDuration(e.target.value)} 
                                    placeholder="Ex: De 01:20 a 01:45" 
                                    className="rounded-2xl bg-white/5 border-white/10 text-white h-11 sm:h-12 text-sm" 
                                    id="public-manual-music-duration"
                                  />
                                </div>
                              )}
                            </div>

                            {isWaveformOpen && durationMode === 'visual' && (isUploadedFile(musicUrl) || !!localMusicBlobUrl) && (
                              <div className="mt-4 text-left w-full" id="public-waveform-selector-container">
                                <WaveformSelector
                                  audioUrl={localMusicBlobUrl || musicUrl || ''}
                                  musicName={musicName || 'Sem nome'}
                                  initialDuration={musicDuration}
                                  onConfirm={(timeStr) => {
                                    setMusicDuration(timeStr);
                                    setIsWaveformOpen(false);
                                  }}
                                  onClose={() => setIsWaveformOpen(false)}
                                  isInline={true}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Submit button */}
                <div className="border-t border-white/5 pt-6 sm:pt-8 flex">
                  <Button 
                    type="submit" 
                    disabled={saving} 
                    className="w-full bg-pink-500 hover:bg-pink-600 text-white rounded-2xl h-12 sm:h-14 font-black shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)] transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 group border-none"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="animate-spin w-4 h-4" />
                        Salvando Suas Informações...
                      </>
                    ) : (
                      <>
                        Salvar e Enviar para Backstage
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
