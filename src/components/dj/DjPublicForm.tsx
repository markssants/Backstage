import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { DjAsset } from '../../types';
import { Button } from '@/components/ui/button';
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
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface DjPublicFormProps {
  eventId: string;
  assetId: string;
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

  // Logo info (Read-only)
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

          setHasVisualMaterial(!!(data.flyerPhoto || data.animationVideo));
          setHasPlaylist(!!(data.musicName || data.musicUrl || data.musicDuration));
          setHasRecordLabel(!!(data.labels && data.labels.length > 0 && data.labels.some(l => l.name?.trim() || l.link?.trim())));
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
      toast.error("O link do presskit é obrigatório.");
      return;
    }

    if (hasVisualMaterial) {
      if (!flyerPhoto.trim()) {
        toast.error("Por favor, preencha a foto para o Flyer.");
        return;
      }
      if (!animationVideo.trim()) {
        toast.error("Por favor, preencha o vídeo para Animação/Motion.");
        return;
      }
    }

    if (hasPlaylist) {
      if (!musicName.trim()) {
        toast.error("Por favor, preencha o nome da música.");
        return;
      }
      if (!musicUrl.trim()) {
        toast.error("Por favor, preencha o link da música.");
        return;
      }
    }

    setSaving(true);
    try {
      const docRef = doc(db, 'events', eventId, 'dj_assets', assetId);
      
      const updateData: Partial<DjAsset> = {
        presskitUrl: presskitUrl.trim(),
        flyerPhoto: hasVisualMaterial ? flyerPhoto.trim() : '',
        animationVideo: hasVisualMaterial ? animationVideo.trim() : '',
        musicName: hasPlaylist ? musicName.trim() : '',
        musicUrl: hasPlaylist ? musicUrl.trim() : '',
        musicDuration: hasPlaylist ? musicDuration.trim() : '',
        presskitStatus: 'completed',
        // Update readable logs as helper
        labelInfo: asset?.hasMandatoryLogo && hasRecordLabel && asset?.labels 
          ? asset.labels.map(l => `${l.name} (${l.link})`).join(', ') 
          : asset?.labelInfo || '',
        agencyInfo: asset?.hasMandatoryLogo && asset?.agencies 
          ? asset.agencies.map(a => `${a.name} (${a.link})`).join(', ') 
          : asset?.agencyInfo || '',
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
    <div className="min-h-screen bg-[#0a0518] text-slate-100 flex flex-col items-center py-12 px-4 relative overflow-y-auto">
      {/* Glow Effects */}
      <div className="glow-purple top-[-10%] left-[-10%] w-[50%] h-[50%] opacity-50" />
      <div className="glow-pink bottom-[10%] right-[-5%] w-[45%] h-[45%] opacity-40" />

      <div className="max-w-2xl w-full relative z-10 space-y-8">
        
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
              className="glass-card p-10 rounded-[2.5rem] border-emerald-500/20 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-white tracking-tight">Tudo Pronto, {asset.name}!</h2>
                <p className="text-slate-400 text-base max-w-md mx-auto">
                  Suas mídias, presskit e trilha de entrada foram salvos e integrados diretamente no cronograma de produção do painel.
                </p>
              </div>

              <div className="pt-6 border-t border-white/5 flex justify-center">
                <Button 
                  onClick={() => setSuccess(false)}
                  className="rounded-2xl h-12 bg-white/5 hover:bg-white/10 text-slate-300 font-bold px-8 uppercase tracking-widest text-[10px]"
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
              className="glass-card rounded-[2.5rem] border-white/5 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            >
              {/* Context bar */}
              <div className="bg-gradient-to-r from-purple-900/40 via-pink-900/20 to-transparent p-8 border-b border-white/5">
                <div className="flex items-center gap-1.5 text-xs text-pink-400 font-black uppercase tracking-widest mb-1">
                  <Sparkles className="w-3.5 h-3.5" /> Ficha de Atendimento
                </div>
                <h1 className="text-3xl font-black uppercase tracking-tight text-white mb-2">{asset.name}</h1>
                <p className="text-slate-400 text-sm max-w-xl">
                  Insira seus links e arquivos abaixo para a produção e assessoria do evento. Você pode editar estas informações a qualquer momento usando este mesmo link.
                </p>

                {/* Deadline & details tags */}
                <div className="flex flex-wrap items-center gap-3 mt-4">
                  {asset.artDeadline && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-pink-500/10 border border-pink-500/20 text-pink-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                      <Calendar className="w-3 h-3" />
                      Prazo do Material: {asset.artDeadline}
                    </div>
                  )}
                  {asset.hasMandatoryLogo && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                      <ShieldCheck className="w-3 h-3" />
                      Logos Obrigatórios Ativos
                    </div>
                  )}
                </div>
              </div>

              {/* Form entries */}
              <form onSubmit={handleSave} className="p-8 space-y-8">
                
                {/* 1 - Link do Presskit */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] uppercase font-black tracking-widest text-slate-300 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-[9px] mr-1">1</span>
                      Link do seu Presskit completo / Promo <span className="text-pink-500 font-bold">*</span>
                    </Label>
                    {presskitUrl && (
                      <a href={presskitUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-pink-400 hover:text-pink-300 font-bold flex items-center gap-1">
                        Ver Link <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <Input 
                    required
                    value={presskitUrl} 
                    onChange={e => setPresskitUrl(e.target.value)} 
                    placeholder="Cole aqui o link do seu GDrive, Dropbox, Linktree ou Direct.me" 
                    className="rounded-2xl bg-white/5 border-white/10 text-white h-12 focus:border-pink-500"
                  />
                  <p className="text-[11px] text-slate-500 leading-relaxed italic">
                    Forneça o link de uma pasta compartilhada contendo suas fotos oficiais em alta resolução, release e logos da assessoria.
                  </p>
                </div>

                {/* 2 - Logos Mandatórios Info */}
                {asset.hasMandatoryLogo && (
                  <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5 space-y-4">
                    <p className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" /> Importante: Logos Obrigatórios em sua Arte
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Sua assessoria configurou as seguintes logos obrigatórias para inserção em suas peças e flyers. Certifique-se de incluí-las na pasta de Presskit caso estejam em branco ou de enviá-las para os designers:
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      {asset.agencies && asset.agencies.length > 0 && asset.agencies.some(a => a.name) && (
                        <div className="space-y-2 bg-white/[0.02] border border-white/5 rounded-xl p-3">
                          <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">Agências de Booking:</p>
                          <ul className="space-y-1.5">
                            {asset.agencies.map((agency, i) => agency.name && (
                              <li key={i} className="text-xs flex items-center justify-between font-bold text-slate-300">
                                <span className="truncate">{agency.name}</span>
                                {agency.link && (
                                  <a href={agency.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-amber-400 hover:underline flex items-center gap-0.5">
                                    Logo <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {asset.labels && asset.labels.length > 0 && asset.labels.some(l => l.name) && (
                        <div className="space-y-2 bg-white/[0.02] border border-white/5 rounded-xl p-3">
                          <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">Gravadoras / Labels:</p>
                          <ul className="space-y-1.5">
                            {asset.labels.map((label, i) => label.name && (
                              <li key={i} className="text-xs flex items-center justify-between font-bold text-slate-300">
                                <span className="truncate">{label.name}</span>
                                {label.link && (
                                  <a href={label.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-amber-400 hover:underline flex items-center gap-0.5">
                                    Logo <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3 - Imagem de Apoio & Motion */}
                <div className="border-t border-white/5 pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Image className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs uppercase font-black tracking-widest text-slate-300">Prefiro enviar uma Foto específica para o flyer</span>
                    </div>
                    <Checkbox 
                      id="public-has-visual-material" 
                      checked={hasVisualMaterial}
                      onCheckedChange={(checked) => setHasVisualMaterial(checked === true)}
                      className="border-slate-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
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
                          <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                            Foto para o Flyer (Ex: Nome do arquivo no Drive ou Link do Drive) <span className="text-pink-500 font-bold">*</span>
                          </Label>
                          <Input value={flyerPhoto} onChange={e => setFlyerPhoto(e.target.value)} placeholder="Ex: foto_oficial_pink.png ou link da foto" className="rounded-2xl bg-white/5 border-white/10 text-white h-12" />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                            Vídeo para Animação / Painel (Nome do arquivo no Drive ou Link do GDrive) <span className="text-pink-500 font-bold">*</span>
                          </Label>
                          <Input value={animationVideo} onChange={e => setAnimationVideo(e.target.value)} placeholder="Ex: painel_loop_dj.mp4 ou link do drive" className="rounded-2xl bg-white/5 border-white/10 text-white h-12" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 4 - Música de Entrada */}
                <div className="border-t border-white/5 pt-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4 text-pink-400" />
                      <span className="text-xs uppercase font-black tracking-widest text-slate-300">Quero enviar uma música para minha trilha no Motion ou rádio comercial</span>
                    </div>
                    <Checkbox 
                      id="public-has-playlist" 
                      checked={hasPlaylist}
                      onCheckedChange={(checked) => setHasPlaylist(checked === true)}
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
                            Nome da Música / Track <span className="text-pink-500 font-bold">*</span>
                          </Label>
                          <Input value={musicName} onChange={e => setMusicName(e.target.value)} placeholder="Ex: Hear Me Now ou Out of Control" className="rounded-2xl bg-white/5 border-white/10 text-white h-12" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                              Link da Música (Audio/YT/Spotify/Drive) <span className="text-pink-500 font-bold">*</span>
                            </Label>
                            <Input value={musicUrl} onChange={e => setMusicUrl(e.target.value)} placeholder="Ex: link do Spotify, Youtube, SoundCloud..." className="rounded-2xl bg-white/5 border-white/10 text-white h-12" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                              Melhor Minuto / Duração para Corte (Opcional)
                            </Label>
                            <Input value={musicDuration} onChange={e => setMusicDuration(e.target.value)} placeholder="Ex: De 01:20 a 01:45" className="rounded-2xl bg-white/5 border-white/10 text-white h-12" />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Submit button */}
                <div className="border-t border-white/5 pt-8 flex">
                  <Button 
                    type="submit" 
                    disabled={saving} 
                    className="w-full bg-pink-500 hover:bg-pink-600 text-white rounded-2xl h-14 font-black shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)] transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 group border-none"
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
