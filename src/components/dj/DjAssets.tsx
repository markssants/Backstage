import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Plus, Music, ExternalLink, Clock, Trash2, Loader2, Disc, 
  Calendar, ShieldAlert, BadgeCheck, Pencil, Film, Image, 
  Sparkles, User, Share2, Upload, Paperclip, Palette, Zap, Users
} from "lucide-react";
import { EventProject, UserProfile, DjAsset, ArtTask, DjAgency, DjLabel, OperationType } from "../../types";
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, getDocs, limit, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../../firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { WaveformSelector } from './WaveformSelector';
import { getDriveAccessToken, uploadFileToGoogleDrive, getGoogleDriveFileId, getOrRequestDriveToken } from '../../lib/googleDrive';
import { DjFormSection } from './DjFormSection';

interface DjAssetsProps {
  event: EventProject;
  profile: UserProfile;
  initialSelectedAssetId?: string | null;
  onClearInitialSelected?: () => void;
  onNavigateToArtTask?: (djAssetId: string) => void;
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

export function DjAssets({ event, profile, initialSelectedAssetId, onClearInitialSelected, onNavigateToArtTask }: DjAssetsProps) {
  const [assets, setAssets] = useState<DjAsset[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [viewOpen, setViewOpen] = useState(false);
  const [selectedViewAsset, setSelectedViewAsset] = useState<DjAsset | null>(null);
  const [viewDjTab, setViewDjTab] = useState<'dj1' | 'dj2'>('dj1');

  // Form Mode State
  const [isVersus, setIsVersus] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<'dj1' | 'dj2' | 'both'>('dj1');

  // DJ 1 State
  const [dj1Name, setDj1Name] = useState('');
  const [dj1PresskitUrl, setDj1PresskitUrl] = useState('');
  const [dj1PresskitType, setDj1PresskitType] = useState<'link' | 'file' | 'email'>('link');
  const [dj1HasMandatoryLogo, setDj1HasMandatoryLogo] = useState(false);
  const [dj1Agencies, setDj1Agencies] = useState<DjAgency[]>([{ name: '', link: '', type: 'link' }]);
  const [dj1HasRecordLabel, setDj1HasRecordLabel] = useState(false);
  const [dj1Labels, setDj1Labels] = useState<DjLabel[]>([{ name: '', link: '', type: 'link' }]);
  const [dj1HasVisualMaterial, setDj1HasVisualMaterial] = useState(false);
  const [dj1VisualMaterialType, setDj1VisualMaterialType] = useState<'both' | 'photo' | 'video'>('both');
  const [dj1FlyerPhoto, setDj1FlyerPhoto] = useState('');
  const [dj1FlyerPhotoType, setDj1FlyerPhotoType] = useState<'link' | 'file'>('link');
  const [dj1AnimationVideo, setDj1AnimationVideo] = useState('');
  const [dj1AnimationVideoType, setDj1AnimationVideoType] = useState<'link' | 'file'>('link');
  const [dj1HasPlaylist, setDj1HasPlaylist] = useState(false);
  const [dj1MusicName, setDj1MusicName] = useState('');
  const [dj1MusicUrl, setDj1MusicUrl] = useState('');
  const [dj1MusicUrlType, setDj1MusicUrlType] = useState<'link' | 'file'>('link');
  const [dj1MusicDuration, setDj1MusicDuration] = useState('');
  const [localMusicBlobUrl1, setLocalMusicBlobUrl1] = useState<string | null>(null);

  // DJ 2 State (for Versus)
  const [dj2Name, setDj2Name] = useState('');
  const [dj2PresskitUrl, setDj2PresskitUrl] = useState('');
  const [dj2PresskitType, setDj2PresskitType] = useState<'link' | 'file' | 'email'>('link');
  const [dj2HasMandatoryLogo, setDj2HasMandatoryLogo] = useState(false);
  const [dj2Agencies, setDj2Agencies] = useState<DjAgency[]>([{ name: '', link: '', type: 'link' }]);
  const [dj2HasRecordLabel, setDj2HasRecordLabel] = useState(false);
  const [dj2Labels, setDj2Labels] = useState<DjLabel[]>([{ name: '', link: '', type: 'link' }]);
  const [dj2HasVisualMaterial, setDj2HasVisualMaterial] = useState(false);
  const [dj2VisualMaterialType, setDj2VisualMaterialType] = useState<'both' | 'photo' | 'video'>('both');
  const [dj2FlyerPhoto, setDj2FlyerPhoto] = useState('');
  const [dj2FlyerPhotoType, setDj2FlyerPhotoType] = useState<'link' | 'file'>('link');
  const [dj2AnimationVideo, setDj2AnimationVideo] = useState('');
  const [dj2AnimationVideoType, setDj2AnimationVideoType] = useState<'link' | 'file'>('link');
  const [dj2HasPlaylist, setDj2HasPlaylist] = useState(false);
  const [dj2MusicName, setDj2MusicName] = useState('');
  const [dj2MusicUrl, setDj2MusicUrl] = useState('');
  const [dj2MusicUrlType, setDj2MusicUrlType] = useState<'link' | 'file'>('link');
  const [dj2MusicDuration, setDj2MusicDuration] = useState('');
  const [localMusicBlobUrl2, setLocalMusicBlobUrl2] = useState<string | null>(null);

  // Shared Common Fields
  const [artDeadline, setArtDeadline] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'urgent'>('medium');
  const [presskitStatus, setPresskitStatus] = useState<'pending' | 'completed'>('pending');

  // Waveform Modal State
  const [activeWaveformTarget, setActiveWaveformTarget] = useState<1 | 2>(1);
  const [isWaveformOpen, setIsWaveformOpen] = useState(false);

  // Upload Tracking
  const [uploadingState, setUploadingState] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // Active Tab for Cards with Versus
  const [cardActiveTabs, setCardActiveTabs] = useState<Record<string, 1 | 2>>({});

  const handleOpenView = (asset: DjAsset) => {
    setSelectedViewAsset(asset);
    setViewDjTab('dj1');
    setViewOpen(true);
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>, 
    fieldKey: string, 
    allowedTypes: string[], 
    maxSizeMB = 50
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      toast.error(`O arquivo excede o limite de tamanho de ${maxSizeMB}MB.`);
      return;
    }

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
        setLocalMusicBlobUrl1(localUrl);
      } catch (err) {
        console.error("Erro ao criar URL do blob local:", err);
      }
    } else if (fieldKey === 'dj2_musicUrl') {
      try {
        const localUrl = URL.createObjectURL(file);
        setLocalMusicBlobUrl2(localUrl);
      } catch (err) {
        console.error("Erro ao criar URL do blob local:", err);
      }
    }

    setUploadingState(prev => ({ ...prev, [fieldKey]: true }));
    setUploadProgress(prev => ({ ...prev, [fieldKey]: 0 }));

    try {
      const accessToken = await getOrRequestDriveToken();
      if (!accessToken) {
        throw new Error("Para realizar o upload, a permissão do Google Drive é obrigatória.");
      }

      const downloadUrl = await uploadFileToGoogleDrive(file, accessToken, (progress) => {
        setUploadProgress(prev => ({ ...prev, [fieldKey]: progress }));
      });

      // DJ 1 handlers
      if (fieldKey === 'presskit') {
        setDj1PresskitUrl(downloadUrl);
        setDj1PresskitType('file');
        toast.success("Presskit (.zip) do DJ 1 enviado!");
      } else if (fieldKey === 'flyerPhoto') {
        setDj1FlyerPhoto(downloadUrl);
        setDj1FlyerPhotoType('file');
        toast.success("Foto do flyer do DJ 1 enviada!");
      } else if (fieldKey === 'animationVideo') {
        setDj1AnimationVideo(downloadUrl);
        setDj1AnimationVideoType('file');
        toast.success("Vídeo do motion do DJ 1 enviado!");
      } else if (fieldKey === 'musicUrl') {
        setDj1MusicUrl(downloadUrl);
        setDj1MusicUrlType('file');
        if (!dj1MusicName) setDj1MusicName(file.name.replace(/\.[^/.]+$/, ""));
        toast.success("Música do DJ 1 enviada!");
      } else if (fieldKey.startsWith('agency_')) {
        const idx = parseInt(fieldKey.split('_')[1], 10);
        const updated = [...dj1Agencies];
        if (updated[idx]) {
          updated[idx] = { ...updated[idx], link: downloadUrl, type: 'file' };
          setDj1Agencies(updated);
        }
        toast.success("Logo da agência do DJ 1 enviada!");
      } else if (fieldKey.startsWith('label_')) {
        const idx = parseInt(fieldKey.split('_')[1], 10);
        const updated = [...dj1Labels];
        if (updated[idx]) {
          updated[idx] = { ...updated[idx], link: downloadUrl, type: 'file' };
          setDj1Labels(updated);
        }
        toast.success("Logo da gravadora do DJ 1 enviada!");
      }
      // DJ 2 handlers
      else if (fieldKey === 'dj2_presskit') {
        setDj2PresskitUrl(downloadUrl);
        setDj2PresskitType('file');
        toast.success("Presskit (.zip) do DJ 2 enviado!");
      } else if (fieldKey === 'dj2_flyerPhoto') {
        setDj2FlyerPhoto(downloadUrl);
        setDj2FlyerPhotoType('file');
        toast.success("Foto do flyer do DJ 2 enviada!");
      } else if (fieldKey === 'dj2_animationVideo') {
        setDj2AnimationVideo(downloadUrl);
        setDj2AnimationVideoType('file');
        toast.success("Vídeo do motion do DJ 2 enviado!");
      } else if (fieldKey === 'dj2_musicUrl') {
        setDj2MusicUrl(downloadUrl);
        setDj2MusicUrlType('file');
        if (!dj2MusicName) setDj2MusicName(file.name.replace(/\.[^/.]+$/, ""));
        toast.success("Música do DJ 2 enviada!");
      } else if (fieldKey.startsWith('dj2_agency_')) {
        const idx = parseInt(fieldKey.split('_')[2], 10);
        const updated = [...dj2Agencies];
        if (updated[idx]) {
          updated[idx] = { ...updated[idx], link: downloadUrl, type: 'file' };
          setDj2Agencies(updated);
        }
        toast.success("Logo da agência do DJ 2 enviada!");
      } else if (fieldKey.startsWith('dj2_label_')) {
        const idx = parseInt(fieldKey.split('_')[2], 10);
        const updated = [...dj2Labels];
        if (updated[idx]) {
          updated[idx] = { ...updated[idx], link: downloadUrl, type: 'file' };
          setDj2Labels(updated);
        }
        toast.success("Logo da gravadora do DJ 2 enviada!");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao realizar upload do arquivo.");
    } finally {
      setUploadingState(prev => ({ ...prev, [fieldKey]: false }));
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'events', event.id, 'dj_assets'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DjAsset)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `events/${event.id}/dj_assets`);
    });
    return () => unsubscribe();
  }, [event.id]);

  useEffect(() => {
    if (initialSelectedAssetId && assets.length > 0) {
      const asset = assets.find(a => a.id === initialSelectedAssetId);
      if (asset) {
        handleOpenView(asset);
        onClearInitialSelected?.();
      }
    }
  }, [initialSelectedAssetId, assets, onClearInitialSelected]);

  const handleOpenEdit = (asset: DjAsset) => {
    setEditingId(asset.id);
    setIsVersus(!!asset.isVersus);
    setActiveFormTab('dj1');

    // DJ 1
    setDj1Name(asset.name || '');
    setDj1PresskitUrl(asset.presskitUrl || '');
    setDj1PresskitType(asset.presskitType || (isUploadedFile(asset.presskitUrl) ? 'file' : 'link'));
    setDj1HasMandatoryLogo(!!asset.hasMandatoryLogo);
    setDj1Agencies(asset.agencies && asset.agencies.length > 0 ? asset.agencies : [{ name: asset.agencyInfo || '', link: '', type: 'link' }]);
    setDj1HasRecordLabel(!!(asset.labels && asset.labels.length > 0 && asset.labels.some(l => l.name?.trim() || l.link?.trim())));
    setDj1Labels(asset.labels && asset.labels.length > 0 ? asset.labels : [{ name: asset.labelInfo || '', link: '', type: 'link' }]);
    setDj1HasVisualMaterial(!!(asset.flyerPhoto || asset.animationVideo));
    setDj1VisualMaterialType(asset.visualMaterialType || 'both');
    setDj1FlyerPhoto(asset.flyerPhoto || '');
    setDj1FlyerPhotoType(asset.flyerPhotoType || (isUploadedFile(asset.flyerPhoto) ? 'file' : 'link'));
    setDj1AnimationVideo(asset.animationVideo || '');
    setDj1AnimationVideoType(asset.animationVideoType || (isUploadedFile(asset.animationVideo) ? 'file' : 'link'));
    setDj1HasPlaylist(!!(asset.musicName || asset.musicUrl || asset.musicDuration));
    setDj1MusicName(asset.musicName || '');
    setDj1MusicUrl(asset.musicUrl || '');
    setDj1MusicUrlType(asset.musicUrlType || (isUploadedFile(asset.musicUrl) ? 'file' : 'link'));
    setDj1MusicDuration(asset.musicDuration || '');

    // DJ 2
    setDj2Name(asset.dj2Name || '');
    setDj2PresskitUrl(asset.dj2PresskitUrl || '');
    setDj2PresskitType(asset.dj2PresskitType || (isUploadedFile(asset.dj2PresskitUrl) ? 'file' : 'link'));
    setDj2HasMandatoryLogo(!!asset.dj2HasMandatoryLogo);
    setDj2Agencies(asset.dj2Agencies && asset.dj2Agencies.length > 0 ? asset.dj2Agencies : [{ name: asset.dj2AgencyInfo || '', link: '', type: 'link' }]);
    setDj2HasRecordLabel(!!(asset.dj2Labels && asset.dj2Labels.length > 0 && asset.dj2Labels.some(l => l.name?.trim() || l.link?.trim())));
    setDj2Labels(asset.dj2Labels && asset.dj2Labels.length > 0 ? asset.dj2Labels : [{ name: asset.dj2LabelInfo || '', link: '', type: 'link' }]);
    setDj2HasVisualMaterial(!!(asset.dj2FlyerPhoto || asset.dj2AnimationVideo));
    setDj2VisualMaterialType(asset.dj2VisualMaterialType || 'both');
    setDj2FlyerPhoto(asset.dj2FlyerPhoto || '');
    setDj2FlyerPhotoType(asset.dj2FlyerPhotoType || (isUploadedFile(asset.dj2FlyerPhoto) ? 'file' : 'link'));
    setDj2AnimationVideo(asset.dj2AnimationVideo || '');
    setDj2AnimationVideoType(asset.dj2AnimationVideoType || (isUploadedFile(asset.dj2AnimationVideo) ? 'file' : 'link'));
    setDj2HasPlaylist(!!(asset.dj2MusicName || asset.dj2MusicUrl || asset.dj2MusicDuration));
    setDj2MusicName(asset.dj2MusicName || '');
    setDj2MusicUrl(asset.dj2MusicUrl || '');
    setDj2MusicUrlType(asset.dj2MusicUrlType || (isUploadedFile(asset.dj2MusicUrl) ? 'file' : 'link'));
    setDj2MusicDuration(asset.dj2MusicDuration || '');

    // Common
    setArtDeadline(asset.artDeadline || '');
    setPriority(asset.priority || 'medium');
    setPresskitStatus(asset.presskitStatus || 'pending');

    setIsOpen(true);

    if (asset.musicUrl && (asset.musicUrlType === 'file' || isUploadedFile(asset.musicUrl))) {
      loadStoredAudioAsBlob(asset.musicUrl, setLocalMusicBlobUrl1);
    }
    if (asset.dj2MusicUrl && (asset.dj2MusicUrlType === 'file' || isUploadedFile(asset.dj2MusicUrl))) {
      loadStoredAudioAsBlob(asset.dj2MusicUrl, setLocalMusicBlobUrl2);
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    clearForm();
    setIsOpen(true);
  };

  const clearForm = () => {
    setEditingId(null);
    setIsVersus(false);
    setActiveFormTab('dj1');

    setDj1Name('');
    setDj1PresskitUrl('');
    setDj1PresskitType('link');
    setDj1HasMandatoryLogo(false);
    setDj1Agencies([{ name: '', link: '', type: 'link' }]);
    setDj1HasRecordLabel(false);
    setDj1Labels([{ name: '', link: '', type: 'link' }]);
    setDj1HasVisualMaterial(false);
    setDj1VisualMaterialType('both');
    setDj1FlyerPhoto('');
    setDj1FlyerPhotoType('link');
    setDj1AnimationVideo('');
    setDj1AnimationVideoType('link');
    setDj1HasPlaylist(false);
    setDj1MusicName('');
    setDj1MusicUrl('');
    setDj1MusicUrlType('link');
    setDj1MusicDuration('');
    setLocalMusicBlobUrl1(null);

    setDj2Name('');
    setDj2PresskitUrl('');
    setDj2PresskitType('link');
    setDj2HasMandatoryLogo(false);
    setDj2Agencies([{ name: '', link: '', type: 'link' }]);
    setDj2HasRecordLabel(false);
    setDj2Labels([{ name: '', link: '', type: 'link' }]);
    setDj2HasVisualMaterial(false);
    setDj2VisualMaterialType('both');
    setDj2FlyerPhoto('');
    setDj2FlyerPhotoType('link');
    setDj2AnimationVideo('');
    setDj2AnimationVideoType('link');
    setDj2HasPlaylist(false);
    setDj2MusicName('');
    setDj2MusicUrl('');
    setDj2MusicUrlType('link');
    setDj2MusicDuration('');
    setLocalMusicBlobUrl2(null);

    setArtDeadline('');
    setPriority('medium');
    setPresskitStatus('pending');
    setIsWaveformOpen(false);
  };

  const handleSave = async () => {
    // 1. Identificação DJ 1
    if (!dj1Name.trim()) {
      toast.error("O campo 'Nome do DJ 1' é obrigatório.");
      return;
    }

    // 2. Identificação DJ 2 if Versus
    if (isVersus && !dj2Name.trim()) {
      toast.error("O modo Versus está ativo. O campo 'Nome do DJ 2' é obrigatório.");
      return;
    }

    // 3. Prazo de Entrega
    if (!artDeadline.trim()) {
      toast.error("O campo 'Prazo de Entrega da Arte' é obrigatório.");
      return;
    }

    // 4. DJ 1 Mandatory Logo validation
    if (dj1HasMandatoryLogo) {
      if (!dj1Agencies || dj1Agencies.length === 0 || !dj1Agencies.some(a => a.name.trim())) {
        toast.error("Adicione pelo menos uma agência para o DJ 1.");
        return;
      }
    }

    // 5. DJ 2 Mandatory Logo validation
    if (isVersus && dj2HasMandatoryLogo) {
      if (!dj2Agencies || dj2Agencies.length === 0 || !dj2Agencies.some(a => a.name.trim())) {
        toast.error("Adicione pelo menos uma agência para o DJ 2.");
        return;
      }
    }

    setLoading(true);
    try {
      const payload: Partial<DjAsset> = {
        name: dj1Name.trim(),
        isVersus: !!isVersus,
        presskitUrl: dj1PresskitUrl,
        presskitType: dj1PresskitType,
        hasMandatoryLogo: !!dj1HasMandatoryLogo,
        agencies: dj1HasMandatoryLogo ? dj1Agencies : [],
        labels: dj1HasMandatoryLogo && dj1HasRecordLabel ? dj1Labels : [],
        agencyInfo: dj1HasMandatoryLogo && dj1Agencies ? dj1Agencies.map(a => `${a.name} (${a.link})`).join(', ') : '',
        labelInfo: dj1HasMandatoryLogo && dj1HasRecordLabel && dj1Labels ? dj1Labels.map(l => `${l.name} (${l.link})`).join(', ') : '',
        visualMaterialType: dj1HasVisualMaterial ? dj1VisualMaterialType : 'both',
        flyerPhoto: dj1HasVisualMaterial && (dj1VisualMaterialType === 'both' || dj1VisualMaterialType === 'photo') ? dj1FlyerPhoto : '',
        flyerPhotoType: dj1FlyerPhotoType,
        animationVideo: dj1HasVisualMaterial && (dj1VisualMaterialType === 'both' || dj1VisualMaterialType === 'video') ? dj1AnimationVideo : '',
        animationVideoType: dj1AnimationVideoType,
        musicName: dj1HasPlaylist ? dj1MusicName : '',
        musicUrl: dj1HasPlaylist ? dj1MusicUrl : '',
        musicUrlType: dj1MusicUrlType,
        musicDuration: dj1HasPlaylist ? dj1MusicDuration : '',

        // DJ 2 Fields (if Versus)
        dj2Name: isVersus ? dj2Name.trim() : '',
        dj2PresskitUrl: isVersus ? dj2PresskitUrl : '',
        dj2PresskitType: isVersus ? dj2PresskitType : 'link',
        dj2HasMandatoryLogo: isVersus ? !!dj2HasMandatoryLogo : false,
        dj2Agencies: isVersus && dj2HasMandatoryLogo ? dj2Agencies : [],
        dj2Labels: isVersus && dj2HasMandatoryLogo && dj2HasRecordLabel ? dj2Labels : [],
        dj2AgencyInfo: isVersus && dj2HasMandatoryLogo && dj2Agencies ? dj2Agencies.map(a => `${a.name} (${a.link})`).join(', ') : '',
        dj2LabelInfo: isVersus && dj2HasMandatoryLogo && dj2HasRecordLabel && dj2Labels ? dj2Labels.map(l => `${l.name} (${l.link})`).join(', ') : '',
        dj2VisualMaterialType: isVersus && dj2HasVisualMaterial ? dj2VisualMaterialType : 'both',
        dj2FlyerPhoto: isVersus && dj2HasVisualMaterial && (dj2VisualMaterialType === 'both' || dj2VisualMaterialType === 'photo') ? dj2FlyerPhoto : '',
        dj2FlyerPhotoType: dj2FlyerPhotoType,
        dj2AnimationVideo: isVersus && dj2HasVisualMaterial && (dj2VisualMaterialType === 'both' || dj2VisualMaterialType === 'video') ? dj2AnimationVideo : '',
        dj2AnimationVideoType: dj2AnimationVideoType,
        dj2MusicName: isVersus && dj2HasPlaylist ? dj2MusicName : '',
        dj2MusicUrl: isVersus && dj2HasPlaylist ? dj2MusicUrl : '',
        dj2MusicUrlType: dj2MusicUrlType,
        dj2MusicDuration: isVersus && dj2HasPlaylist ? dj2MusicDuration : '',

        // Common Fields
        artDeadline,
        priority,
        presskitStatus: (dj1PresskitUrl || (isVersus && dj2PresskitUrl)) ? 'completed' : presskitStatus
      };

      if (editingId) {
        const updateData: any = {};
        Object.entries(payload).forEach(([key, value]) => {
          if (value !== undefined) {
            updateData[key] = value;
          }
        });

        await updateDoc(doc(db, 'events', event.id, 'dj_assets', editingId), {
          ...updateData,
          updatedAt: serverTimestamp(),
        });
        toast.success(isVersus ? "Informações do Versus atualizadas com sucesso!" : "Informações do DJ atualizadas com sucesso!");
      } else {
        const assetRef = await addDoc(collection(db, 'events', event.id, 'dj_assets'), {
          ...payload,
          eventId: event.id,
          createdAt: serverTimestamp(),
        });

        // Automatically create Art Task if deadline is set
        if (payload.artDeadline) {
          const artsPath = `events/${event.id}/arts`;
          const artsSnap = await getDocs(query(collection(db, artsPath), limit(500)));
          const todoArts = artsSnap.docs.map(d => d.data() as ArtTask).filter(a => a.status === 'todo');
          const maxPosition = todoArts.length > 0 ? Math.max(...todoArts.map(a => a.position || 0)) : 0;

          const titleDisplay = isVersus ? `Arte DJ: ${payload.name} VS ${payload.dj2Name}` : `Arte DJ: ${payload.name}`;
          const descDisplay = isVersus 
            ? `Versus / B2B cadastrado via Presskits.\n\n--- DJ 1: ${payload.name} ---\nPresskit: ${payload.presskitUrl || '-'}\nFoto: ${payload.flyerPhoto || '-'}\nMúsica: ${payload.musicName || '-'}\n\n--- DJ 2: ${payload.dj2Name} ---\nPresskit: ${payload.dj2PresskitUrl || '-'}\nFoto: ${payload.dj2FlyerPhoto || '-'}\nMúsica: ${payload.dj2MusicName || '-'}`
            : `DJ cadastrado via Presskits.\n\nPresskit: ${payload.presskitUrl || 'Não informado'}\nAtração: ${payload.name}\nMúsica: ${payload.musicName || 'Não informada'}\nFoto p/ Flyer: ${payload.flyerPhoto || 'Não informada'}\nVídeo p/ Animação: ${payload.animationVideo || 'Não informado'}${payload.hasMandatoryLogo ? `\n\n⚠️ LOGO OBRIGATÓRIA:\nAgencia: ${payload.agencyInfo || '-'}\nGravadora: ${payload.labelInfo || '-'}` : ''}`;

          await addDoc(collection(db, artsPath), {
            title: titleDisplay,
            description: descDisplay,
            priority: payload.priority || 'medium',
            category: 'dj',
            deadline: payload.artDeadline,
            status: 'todo',
            position: maxPosition + 1000,
            eventId: event.id,
            createdAt: serverTimestamp(),
            sourceAssetId: assetRef.id
          });
          
          toast.info("Tarefa de arte criada automaticamente no quadro!");
        }
        toast.success(isVersus ? "Atração Versus adicionada com sucesso!" : "DJ adicionado com sucesso!");
      }

      setIsOpen(false);
      clearForm();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar informações.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'events', event.id, 'dj_assets', id));
      toast.success("Atração removida com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao remover atração.");
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    const leadingDays = firstDay.getDay();
    for (let i = 0; i < leadingDays; i++) {
      days.push(null);
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const calendarDays = getDaysInMonth(currentMonth);
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const monthName = currentMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));

  const handleDragStart = (e: React.DragEvent, assetId: string) => {
    e.dataTransfer.setData('assetId', assetId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const assetId = e.dataTransfer.getData('assetId');
    if (!assetId) return;

    const dateStr = date.toISOString().split('T')[0];
    
    try {
      await updateDoc(doc(db, 'events', event.id, 'dj_assets', assetId), {
        artDeadline: dateStr,
        updatedAt: serverTimestamp()
      });
      toast.success("Deadline atualizada!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar data.");
    }
  };

  const filteredAssets = assets.filter(asset => {
    const matchPriority = priorityFilter === 'all' || asset.priority === priorityFilter;
    const matchStatus = statusFilter === 'all' || asset.presskitStatus === statusFilter;
    return matchPriority && matchStatus;
  });

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-black uppercase tracking-[0.15em] text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 italic">
            DJs & Presskits
          </h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">
            Controle de atrações solo, duplas (Versus/B2B), presskits e trilhas
          </p>
        </div>

        {/* Modal Adicionar / Editar DJ */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger render={
            <Button onClick={handleOpenCreate} className="bg-gradient-to-tr from-purple-500 to-pink-500 text-white rounded-2xl h-12 px-6 border-none font-black transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(168,85,247,0.3)] w-full sm:w-auto flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />
              Adicionar DJ / Atração
            </Button>
          } />
          <DialogContent className="rounded-[2rem] sm:max-w-[900px] w-[95vw] glass border-white/10 text-slate-100 p-4 sm:p-8 max-h-[94vh] overflow-hidden flex flex-col">
            <DialogHeader className="shrink-0 pb-4 border-b border-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-lg shrink-0">
                    <Disc className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                      {editingId ? "Editar Atração" : "Cadastrar Nova Atração"}
                      {isVersus && (
                        <span className="text-[9px] bg-gradient-to-r from-pink-500 to-rose-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest shadow-md">
                          VS / B2B
                        </span>
                      )}
                    </DialogTitle>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {isVersus ? "Cadastro duplo para confronto/apresentação em conjunto" : "Preencha as informações do DJ para confecção dos materiais"}
                    </p>
                  </div>
                </div>
              </div>

              {/* BOTÃO PRINCIPAL: MODO VERSUS (VS / 2 DJS) */}
              <div className="mt-4 bg-white/5 border border-white/10 p-2 rounded-2xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 pl-2">
                  <Zap className={cn("w-4 h-4 transition-colors", isVersus ? "text-amber-400 animate-pulse" : "text-slate-500")} />
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-200">
                    Modo da Apresentação:
                  </span>
                </div>
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsVersus(false)}
                    className={cn(
                      "h-9 px-3 sm:px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5",
                      !isVersus 
                        ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] font-extrabold" 
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <User className="w-3.5 h-3.5" />
                    Solo (1 DJ)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsVersus(true);
                      if (activeFormTab === 'both') setActiveFormTab('dj1');
                    }}
                    className={cn(
                      "h-9 px-3 sm:px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5",
                      isVersus 
                        ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.5)] font-extrabold" 
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <Users className="w-3.5 h-3.5 text-amber-300" />
                    Versus (VS / 2 DJs)
                  </button>
                </div>
              </div>

              {/* Sub-abas quando Versus estiver ativo */}
              {isVersus && (
                <div className="mt-3 flex bg-white/5 p-1 rounded-2xl border border-pink-500/20">
                  <button
                    type="button"
                    onClick={() => setActiveFormTab('dj1')}
                    className={cn(
                      "flex-1 h-8 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer truncate px-2",
                      activeFormTab === 'dj1' 
                        ? "bg-purple-600 text-white shadow-md font-bold" 
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    🎧 DJ 1: {dj1Name || 'Primeiro DJ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFormTab('dj2')}
                    className={cn(
                      "flex-1 h-8 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer truncate px-2",
                      activeFormTab === 'dj2' 
                        ? "bg-pink-600 text-white shadow-md font-bold" 
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    🎧 DJ 2: {dj2Name || 'Segundo DJ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFormTab('both')}
                    className={cn(
                      "flex-1 h-8 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer truncate px-2 hidden sm:block",
                      activeFormTab === 'both' 
                        ? "bg-white/20 text-white shadow-md font-bold" 
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    📋 Ver Ambos
                  </button>
                </div>
              )}
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-6 space-y-6 pr-1 custom-scrollbar">
              {/* DJ 1 Form Section */}
              {(!isVersus || activeFormTab === 'dj1' || activeFormTab === 'both') && (
                <DjFormSection
                  djNumber={1}
                  title={isVersus ? "Informações & Mídias do DJ 1" : "Informações & Mídias da Atração"}
                  theme="purple"
                  djName={dj1Name}
                  onDjNameChange={setDj1Name}
                  presskitUrl={dj1PresskitUrl}
                  presskitType={dj1PresskitType}
                  onPresskitChange={(url, type) => {
                    setDj1PresskitUrl(url);
                    setDj1PresskitType(type);
                  }}
                  hasMandatoryLogo={dj1HasMandatoryLogo}
                  onHasMandatoryLogoChange={setDj1HasMandatoryLogo}
                  agencies={dj1Agencies}
                  onAgenciesChange={setDj1Agencies}
                  hasRecordLabel={dj1HasRecordLabel}
                  onHasRecordLabelChange={setDj1HasRecordLabel}
                  labels={dj1Labels}
                  onLabelsChange={setDj1Labels}
                  hasVisualMaterial={dj1HasVisualMaterial}
                  onHasVisualMaterialChange={setDj1HasVisualMaterial}
                  visualMaterialType={dj1VisualMaterialType}
                  onVisualMaterialTypeChange={setDj1VisualMaterialType}
                  flyerPhoto={dj1FlyerPhoto}
                  flyerPhotoType={dj1FlyerPhotoType}
                  onFlyerPhotoChange={(url, type) => {
                    setDj1FlyerPhoto(url);
                    setDj1FlyerPhotoType(type);
                  }}
                  animationVideo={dj1AnimationVideo}
                  animationVideoType={dj1AnimationVideoType}
                  onAnimationVideoChange={(url, type) => {
                    setDj1AnimationVideo(url);
                    setDj1AnimationVideoType(type);
                  }}
                  hasPlaylist={dj1HasPlaylist}
                  onHasPlaylistChange={setDj1HasPlaylist}
                  musicName={dj1MusicName}
                  onMusicNameChange={setDj1MusicName}
                  musicUrl={dj1MusicUrl}
                  musicUrlType={dj1MusicUrlType}
                  musicDuration={dj1MusicDuration}
                  onMusicDurationChange={setDj1MusicDuration}
                  onMusicTypeChange={setDj1MusicUrlType}
                  onClearMusic={() => {
                    setDj1MusicUrl('');
                    setDj1MusicUrlType('link');
                    setLocalMusicBlobUrl1(null);
                  }}
                  localMusicBlobUrl={localMusicBlobUrl1}
                  uploadingState={uploadingState}
                  uploadProgress={uploadProgress}
                  onFileUpload={handleFileUpload}
                  onOpenWaveform={() => {
                    setActiveWaveformTarget(1);
                    setIsWaveformOpen(true);
                  }}
                  fieldPrefix=""
                />
              )}

              {/* DJ 2 Form Section (when Versus is active) */}
              {isVersus && (activeFormTab === 'dj2' || activeFormTab === 'both') && (
                <DjFormSection
                  djNumber={2}
                  title="Informações & Mídias do DJ 2 (Versus)"
                  theme="pink"
                  djName={dj2Name}
                  onDjNameChange={setDj2Name}
                  presskitUrl={dj2PresskitUrl}
                  presskitType={dj2PresskitType}
                  onPresskitChange={(url, type) => {
                    setDj2PresskitUrl(url);
                    setDj2PresskitType(type);
                  }}
                  hasMandatoryLogo={dj2HasMandatoryLogo}
                  onHasMandatoryLogoChange={setDj2HasMandatoryLogo}
                  agencies={dj2Agencies}
                  onAgenciesChange={setDj2Agencies}
                  hasRecordLabel={dj2HasRecordLabel}
                  onHasRecordLabelChange={setDj2HasRecordLabel}
                  labels={dj2Labels}
                  onLabelsChange={setDj2Labels}
                  hasVisualMaterial={dj2HasVisualMaterial}
                  onHasVisualMaterialChange={setDj2HasVisualMaterial}
                  visualMaterialType={dj2VisualMaterialType}
                  onVisualMaterialTypeChange={setDj2VisualMaterialType}
                  flyerPhoto={dj2FlyerPhoto}
                  flyerPhotoType={dj2FlyerPhotoType}
                  onFlyerPhotoChange={(url, type) => {
                    setDj2FlyerPhoto(url);
                    setDj2FlyerPhotoType(type);
                  }}
                  animationVideo={dj2AnimationVideo}
                  animationVideoType={dj2AnimationVideoType}
                  onAnimationVideoChange={(url, type) => {
                    setDj2AnimationVideo(url);
                    setDj2AnimationVideoType(type);
                  }}
                  hasPlaylist={dj2HasPlaylist}
                  onHasPlaylistChange={setDj2HasPlaylist}
                  musicName={dj2MusicName}
                  onMusicNameChange={setDj2MusicName}
                  musicUrl={dj2MusicUrl}
                  musicUrlType={dj2MusicUrlType}
                  musicDuration={dj2MusicDuration}
                  onMusicDurationChange={setDj2MusicDuration}
                  onMusicTypeChange={setDj2MusicUrlType}
                  onClearMusic={() => {
                    setDj2MusicUrl('');
                    setDj2MusicUrlType('link');
                    setLocalMusicBlobUrl2(null);
                  }}
                  localMusicBlobUrl={localMusicBlobUrl2}
                  uploadingState={uploadingState}
                  uploadProgress={uploadProgress}
                  onFileUpload={handleFileUpload}
                  onOpenWaveform={() => {
                    setActiveWaveformTarget(2);
                    setIsWaveformOpen(true);
                  }}
                  fieldPrefix="dj2_"
                />
              )}

              {/* Shared Settings: Prazo & Prioridade */}
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-300">
                    Prazo e Prioridade da Arte
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1">
                      Data de Entrega da Arte <span className="text-pink-500 font-bold">*</span>
                    </Label>
                    <Input 
                      type="date" 
                      value={artDeadline} 
                      onChange={e => setArtDeadline(e.target.value)} 
                      className="rounded-2xl bg-white/5 border-white/10 text-white h-12 text-sm font-bold" 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                      Prioridade da Arte
                    </Label>
                    <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                      <button
                        type="button"
                        onClick={() => setPriority('low')}
                        className={cn(
                          "flex-1 rounded-xl text-[9px] font-black uppercase tracking-widest h-10 transition-all cursor-pointer",
                          priority === 'low' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold shadow-inner" : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        Baixa
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriority('medium')}
                        className={cn(
                          "flex-1 rounded-xl text-[9px] font-black uppercase tracking-widest h-10 transition-all cursor-pointer",
                          priority === 'medium' ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold shadow-inner" : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        Média
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriority('urgent')}
                        className={cn(
                          "flex-1 rounded-xl text-[9px] font-black uppercase tracking-widest h-10 transition-all cursor-pointer",
                          priority === 'urgent' ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold shadow-inner" : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        Urgente
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Waveform Selector Inline Popup / Drawer */}
            {isWaveformOpen && (
              <div className="p-4 bg-black/80 border-t border-white/10 rounded-2xl animate-fade-in">
                <WaveformSelector
                  audioUrl={
                    activeWaveformTarget === 1 
                      ? (localMusicBlobUrl1 || dj1MusicUrl || '') 
                      : (localMusicBlobUrl2 || dj2MusicUrl || '')
                  }
                  musicName={
                    activeWaveformTarget === 1 
                      ? (dj1MusicName || 'Música do DJ 1') 
                      : (dj2MusicName || 'Música do DJ 2')
                  }
                  initialDuration={activeWaveformTarget === 1 ? dj1MusicDuration : dj2MusicDuration}
                  onConfirm={(timeStr) => {
                    if (activeWaveformTarget === 1) {
                      setDj1MusicDuration(timeStr);
                    } else {
                      setDj2MusicDuration(timeStr);
                    }
                    setIsWaveformOpen(false);
                  }}
                  onClose={() => setIsWaveformOpen(false)}
                  isInline={true}
                />
              </div>
            )}

            <DialogFooter className="pt-4 border-t border-white/5 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 shrink-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsOpen(false)} 
                className="w-full sm:w-1/3 rounded-2xl h-12 sm:h-14 border-white/10 hover:bg-white/5 font-black text-slate-300 uppercase tracking-widest text-xs"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={loading} 
                className="w-full sm:w-2/3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-2xl h-12 sm:h-14 font-black shadow-[0_0_20px_rgba(236,72,153,0.3)] uppercase tracking-widest text-xs flex items-center justify-center gap-2 border-none"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? "Salvar Alterações" : isVersus ? "Adicionar Versus à Programação" : "Adicionar DJ à Programação"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Visualização Completa */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="rounded-[2rem] sm:max-w-[750px] w-[95vw] glass border-white/10 text-slate-100 p-4 sm:p-8 max-h-[92vh] overflow-hidden flex flex-col">
            <DialogHeader className="shrink-0 pb-4 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                    <Disc className="w-5 h-5 text-white animate-spin" style={{ animationDuration: '6s' }} />
                  </div>
                  <div>
                    <DialogTitle className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                      {selectedViewAsset?.name}
                      {selectedViewAsset?.isVersus && (
                        <>
                          <span className="text-pink-400 font-extrabold text-sm px-1.5 py-0.5 rounded bg-pink-500/20">VS</span>
                          <span>{selectedViewAsset?.dj2Name}</span>
                        </>
                      )}
                    </DialogTitle>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {selectedViewAsset?.isVersus ? "Ficha de Confronto / Apresentação Versus (B2B)" : "Ficha de Informações do DJ / Atração"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full",
                    selectedViewAsset?.presskitStatus === 'completed' ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-slate-400"
                  )}>
                    {selectedViewAsset?.presskitStatus === 'completed' ? 'Preenchido' : 'Pendente'}
                  </span>
                </div>
              </div>

              {selectedViewAsset?.isVersus && (
                <div className="mt-3 flex bg-white/5 p-1 rounded-2xl border border-pink-500/20">
                  <button
                    type="button"
                    onClick={() => setViewDjTab('dj1')}
                    className={cn(
                      "flex-1 h-8 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer truncate px-2",
                      viewDjTab === 'dj1' ? "bg-purple-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    🎧 DJ 1: {selectedViewAsset.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewDjTab('dj2')}
                    className={cn(
                      "flex-1 h-8 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer truncate px-2",
                      viewDjTab === 'dj2' ? "bg-pink-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    🎧 DJ 2: {selectedViewAsset.dj2Name || 'Segundo DJ'}
                  </button>
                </div>
              )}
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-6 space-y-6 pr-1 custom-scrollbar">
              {/* Link de Preenchimento Exclusivo */}
              {selectedViewAsset && (
                <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase font-black tracking-widest text-purple-400 font-extrabold">
                      Link de Preenchimento Exclusivo para o DJ
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Envie este link para o próprio DJ preencher suas mídias diretamente!
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      const shareUrl = `${window.location.origin}${window.location.pathname}?djShare=${event.id}_${selectedViewAsset.id}`;
                      navigator.clipboard.writeText(shareUrl);
                      toast.success("Link exclusivo copiado com sucesso!");
                    }}
                    className="rounded-xl h-10 px-4 bg-purple-500 hover:bg-purple-600 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 border-none shrink-0"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Copiar Link
                  </Button>
                </div>
              )}

              {/* Informações detalhadas com base na aba ativa */}
              {(() => {
                const isDj2 = selectedViewAsset?.isVersus && viewDjTab === 'dj2';
                const pUrl = isDj2 ? selectedViewAsset?.dj2PresskitUrl : selectedViewAsset?.presskitUrl;
                const pType = isDj2 ? selectedViewAsset?.dj2PresskitType : selectedViewAsset?.presskitType;
                const hasLogo = isDj2 ? selectedViewAsset?.dj2HasMandatoryLogo : selectedViewAsset?.hasMandatoryLogo;
                const agencies = isDj2 ? selectedViewAsset?.dj2Agencies : selectedViewAsset?.agencies;
                const labels = isDj2 ? selectedViewAsset?.dj2Labels : selectedViewAsset?.labels;
                const flyer = isDj2 ? selectedViewAsset?.dj2FlyerPhoto : selectedViewAsset?.flyerPhoto;
                const anim = isDj2 ? selectedViewAsset?.dj2AnimationVideo : selectedViewAsset?.animationVideo;
                const musicN = isDj2 ? selectedViewAsset?.dj2MusicName : selectedViewAsset?.musicName;
                const musicU = isDj2 ? selectedViewAsset?.dj2MusicUrl : selectedViewAsset?.musicUrl;
                const musicD = isDj2 ? selectedViewAsset?.dj2MusicDuration : selectedViewAsset?.musicDuration;

                return (
                  <div className="space-y-6">
                    {/* Presskit */}
                    <div className="space-y-2">
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        Link do Presskit & Fotos {selectedViewAsset?.isVersus && `(DJ ${viewDjTab === 'dj2' ? '2' : '1'})`}
                      </p>
                      {pUrl ? (
                        pType === 'email' ? (
                          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                            <p className="text-xs text-slate-300 font-bold">📨 Material a ser enviado via e-mail ({pUrl})</p>
                          </div>
                        ) : (
                          <a 
                            href={pUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all group"
                          >
                            <div className="flex items-center space-x-3 truncate">
                              <Music className="w-4 h-4 text-pink-400 shrink-0" />
                              <span className="text-xs font-bold text-slate-200 truncate">{pUrl}</span>
                            </div>
                            <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-pink-400 transition-colors shrink-0" />
                          </a>
                        )
                      ) : (
                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                          <p className="text-xs text-slate-500 italic">Pendente / Não fornecido</p>
                        </div>
                      )}
                    </div>

                    {/* Logos Obrigatórios */}
                    <div className="space-y-2">
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                        Logos Obrigatórios {selectedViewAsset?.isVersus && `(DJ ${viewDjTab === 'dj2' ? '2' : '1'})`}
                      </p>
                      {hasLogo ? (
                        <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 space-y-4">
                          <div className="space-y-2">
                            <p className="text-[9px] uppercase font-black tracking-widest text-amber-400/80">Agência(s)</p>
                            {agencies && agencies.length > 0 ? (
                              <div className="space-y-1.5">
                                {agencies.map((agency, i) => (
                                  <div key={i} className="text-xs flex items-center justify-between font-bold text-slate-200 bg-white/5 border border-white/5 rounded-xl px-3 py-2">
                                    <span className="truncate">{agency.name || '-'}</span>
                                    {agency.link && (
                                      <a href={agency.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-pink-400 hover:text-pink-300">
                                        Ver Logo
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 italic">Nenhuma agência cadastrada.</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <p className="text-[9px] uppercase font-black tracking-widest text-amber-400/80">Gravadora(s)</p>
                            {labels && labels.length > 0 && labels.some(l => l.name?.trim()) ? (
                              <div className="space-y-1.5">
                                {labels.map((label, i) => label.name && (
                                  <div key={i} className="text-xs flex items-center justify-between font-bold text-slate-200 bg-white/5 border border-white/5 rounded-xl px-3 py-2">
                                    <span className="truncate">{label.name}</span>
                                    {label.link && (
                                      <a href={label.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-pink-400 hover:text-pink-300">
                                        Ver Logo
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 italic">Nenhuma gravadora cadastrada.</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                          <p className="text-xs text-slate-500 italic">Nenhum logo obrigatório exigido.</p>
                        </div>
                      )}
                    </div>

                    {/* Foto Flyer e Motion */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-2">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                          <Image className="w-3.5 h-3.5 text-blue-400" />
                          Foto p/ Flyer
                        </p>
                        {flyer ? (
                          <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex flex-col justify-between h-[80px]">
                            <p className="text-xs font-bold text-slate-200 line-clamp-2">{flyer}</p>
                            {flyer.startsWith('http') && (
                              <a href={flyer} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-bold mt-1">
                                Acessar link <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 italic py-3 text-center">Pendente / Não enviada</p>
                        )}
                      </div>

                      <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-2">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                          <Film className="w-3.5 h-3.5 text-teal-400" />
                          Vídeo p/ Motion
                        </p>
                        {anim ? (
                          <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex flex-col justify-between h-[80px]">
                            <p className="text-xs font-bold text-slate-200 line-clamp-2">{anim}</p>
                            {anim.startsWith('http') && (
                              <a href={anim} target="_blank" rel="noopener noreferrer" className="text-[10px] text-teal-400 hover:text-teal-300 flex items-center gap-1 font-bold mt-1">
                                Acessar link <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 italic py-3 text-center">Pendente / Não enviado</p>
                        )}
                      </div>
                    </div>

                    {/* Trilha de Entrada */}
                    <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-2">
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                        <Music className="w-3.5 h-3.5 text-pink-400" />
                        Música de Entrada (Track)
                      </p>
                      {musicN ? (
                        <div className="p-4 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl border border-white/5 flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-black text-white">{musicN}</p>
                            <div className="flex items-center space-x-2 text-slate-400">
                              <Clock className="w-3 h-3 text-purple-400 animate-pulse" />
                              <span className="text-[10px] font-black uppercase">{musicD || "Duração livre"}</span>
                            </div>
                          </div>
                          {musicU && (
                            <a href={musicU} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white/10 p-2.5 hover:bg-pink-500 hover:text-white transition-all text-slate-300">
                              <Music className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic py-3 text-center">Nenhuma trilha fornecida.</p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <DialogFooter className="pt-4 border-t border-white/5 flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewOpen(false)}
                className="w-full sm:flex-1 rounded-2xl h-12 border-white/10 hover:bg-white/5 font-black text-slate-300 uppercase tracking-widest text-xs"
              >
                Fechar
              </Button>
              {onNavigateToArtTask && selectedViewAsset && (
                <Button
                  type="button"
                  onClick={() => {
                    setViewOpen(false);
                    onNavigateToArtTask(selectedViewAsset.id);
                  }}
                  className="w-full sm:flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border border-purple-500/20 rounded-2xl h-12 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_0_20px_rgba(147,51,234,0.3)]"
                >
                  <Palette className="w-3.5 h-3.5" />
                  Ver em Artes
                </Button>
              )}
              <Button
                onClick={() => {
                  setViewOpen(false);
                  if (selectedViewAsset) {
                    handleOpenEdit(selectedViewAsset);
                  }
                }}
                className="w-full sm:flex-1 bg-pink-500 hover:bg-pink-600 text-white rounded-2xl h-12 font-black shadow-[0_0_20px_rgba(236,72,153,0.3)] uppercase tracking-widest text-xs flex items-center justify-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                Editar Informações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Controles de Visualização e Filtros */}
      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 backdrop-blur-md">
        {/* View Selector */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic pl-1">Exibição</span>
          <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn(
                "flex-1 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                viewMode === 'grid' ? "bg-white/10 text-white shadow-lg font-bold" : "text-slate-500 hover:text-slate-300"
              )}
            >
              Lista
            </button>
            <button 
              onClick={() => setViewMode('calendar')}
              className={cn(
                "flex-1 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                viewMode === 'calendar' ? "bg-white/10 text-white shadow-lg font-bold" : "text-slate-500 hover:text-slate-300"
              )}
            >
              Calendário
            </button>
          </div>
        </div>

        {/* Priority Filter */}
        <div className="flex flex-col gap-1.5 flex-[1.4] min-w-[220px]">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic pl-1">Prioridade da Arte</span>
          <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
            {[
              { key: 'all', label: 'Todas' },
              { key: 'low', label: 'Baixa' },
              { key: 'medium', label: 'Média' },
              { key: 'urgent', label: 'Urgente' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setPriorityFilter(tab.key)}
                className={cn(
                  "flex-1 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                  priorityFilter === tab.key ? "bg-white/10 text-white shadow-lg font-bold" : "text-slate-500 hover:text-slate-300"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic pl-1">Status Presskit</span>
          <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
            {[
              { key: 'all', label: 'Todos' },
              { key: 'pending', label: 'Pendente' },
              { key: 'completed', label: 'Preenchido' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key as any)}
                className={cn(
                  "flex-1 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                  statusFilter === tab.key ? "bg-white/10 text-white shadow-lg font-bold" : "text-slate-500 hover:text-slate-300"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map(asset => {
            const cardTab = cardActiveTabs[asset.id] || 1;
            const isVersusCard = !!asset.isVersus;

            const curName = (isVersusCard && cardTab === 2) ? (asset.dj2Name || 'DJ 2') : asset.name;
            const curPresskit = (isVersusCard && cardTab === 2) ? asset.dj2PresskitUrl : asset.presskitUrl;
            const curPresskitType = (isVersusCard && cardTab === 2) ? asset.dj2PresskitType : asset.presskitType;
            const curHasMandatory = (isVersusCard && cardTab === 2) ? asset.dj2HasMandatoryLogo : asset.hasMandatoryLogo;
            const curAgencies = (isVersusCard && cardTab === 2) ? asset.dj2Agencies : asset.agencies;
            const curLabels = (isVersusCard && cardTab === 2) ? asset.dj2Labels : asset.labels;
            const curFlyer = (isVersusCard && cardTab === 2) ? asset.dj2FlyerPhoto : asset.flyerPhoto;
            const curVideo = (isVersusCard && cardTab === 2) ? asset.dj2AnimationVideo : asset.animationVideo;
            const curMusicName = (isVersusCard && cardTab === 2) ? asset.dj2MusicName : asset.musicName;
            const curMusicUrl = (isVersusCard && cardTab === 2) ? asset.dj2MusicUrl : asset.musicUrl;
            const curMusicDuration = (isVersusCard && cardTab === 2) ? asset.dj2MusicDuration : asset.musicDuration;

            return (
              <Card 
                key={asset.id} 
                onClick={() => handleOpenView(asset)}
                className={cn(
                  "rounded-[2rem] border-white/5 bg-white/5 backdrop-blur-md shadow-2xl transition-all duration-300 overflow-hidden group border cursor-pointer select-none",
                  isVersusCard 
                    ? "hover:shadow-pink-500/20 hover:border-pink-500/30" 
                    : "hover:shadow-purple-500/15 hover:border-purple-500/20"
                )}
              >
                {/* Card Header */}
                <div className="bg-white/5 p-6 border-b border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 text-white min-w-0">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform shrink-0",
                        isVersusCard ? "bg-gradient-to-tr from-pink-600 to-rose-600" : "bg-gradient-to-tr from-purple-600 to-indigo-600"
                      )}>
                        <Disc className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-black text-base sm:text-lg uppercase tracking-tight text-white truncate max-w-[200px]">
                            {asset.name}
                          </h3>
                          {isVersusCard && (
                            <>
                              <span className="text-[10px] font-black text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded-md border border-rose-500/30 shadow-sm">
                                VS
                              </span>
                              <h3 className="font-black text-base sm:text-lg uppercase tracking-tight text-white truncate max-w-[200px]">
                                {asset.dj2Name || 'DJ 2'}
                              </h3>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => {
                          e.stopPropagation();
                          const shareUrl = `${window.location.origin}${window.location.pathname}?djShare=${event.id}_${asset.id}`;
                          navigator.clipboard.writeText(shareUrl);
                          toast.success(`Link de preenchimento para ${asset.name} copiado com sucesso!`);
                        }} 
                        className="text-slate-400 hover:text-emerald-400 hover:bg-white/5 rounded-full transition-colors"
                        title="Copiar Link de Envio para o DJ"
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(asset);
                        }} 
                        className="text-slate-400 hover:text-indigo-400 hover:bg-white/5 rounded-full transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(asset.id);
                        }} 
                        className="text-slate-400 hover:text-rose-500 hover:bg-white/5 rounded-full transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={cn(
                      "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                      asset.presskitStatus === 'completed' ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-slate-400"
                    )}>
                      <BadgeCheck className={cn("w-2.5 h-2.5", asset.presskitStatus === 'completed' ? "text-emerald-400" : "text-slate-600")} />
                      {asset.presskitStatus === 'completed' ? 'Preenchido' : 'Pendente'}
                    </div>

                    {asset.priority && (
                      <div className={cn(
                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                        asset.priority === 'urgent' ? "bg-rose-500/20 text-rose-400" :
                        asset.priority === 'medium' ? "bg-amber-500/20 text-amber-400" :
                        "bg-emerald-500/20 text-emerald-400"
                      )}>
                        {asset.priority === 'low' ? 'Baixa' : asset.priority === 'medium' ? 'Média' : 'Urgente'}
                      </div>
                    )}

                    {asset.artDeadline && (
                      <div className="flex items-center gap-1 text-pink-400">
                        <Calendar className="w-2.5 h-2.5" />
                        <span className="text-[9px] font-black uppercase tracking-tighter">Arte p/ {asset.artDeadline}</span>
                      </div>
                    )}

                    {isVersusCard && (
                      <span className="text-[8px] bg-pink-500/20 text-pink-400 border border-pink-500/30 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                        Versus B2B
                      </span>
                    )}
                  </div>

                  {/* Card Tab Switcher for Versus */}
                  {isVersusCard && (
                    <div className="flex bg-black/40 p-0.5 rounded-xl border border-white/5 mt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCardActiveTabs(prev => ({ ...prev, [asset.id]: 1 }));
                        }}
                        className={cn(
                          "flex-1 h-7 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all truncate px-2",
                          cardTab === 1 ? "bg-purple-600 text-white font-bold" : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        DJ 1: {asset.name}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCardActiveTabs(prev => ({ ...prev, [asset.id]: 2 }));
                        }}
                        className={cn(
                          "flex-1 h-7 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all truncate px-2",
                          cardTab === 2 ? "bg-pink-600 text-white font-bold" : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        DJ 2: {asset.dj2Name || 'DJ 2'}
                      </button>
                    </div>
                  )}
                </div>

                <CardContent className="p-6 space-y-5">
                  {/* 1 - Link do Presskit & Fotos */}
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      Presskit & Fotos {isVersusCard && `(${cardTab === 2 ? 'DJ 2' : 'DJ 1'})`}
                    </p>
                    {curPresskit ? (
                      curPresskitType === 'email' ? (
                        <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-2xl border border-white/10">
                          <span className="text-xs font-bold text-slate-200 truncate">📨 {curPresskit}</span>
                        </div>
                      ) : (
                        <a 
                          href={curPresskit} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-between p-3.5 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all group/link"
                        >
                          <div className="flex items-center space-x-3 truncate">
                            <Music className="w-4 h-4 text-pink-400 shrink-0" />
                            <span className="text-xs font-bold text-slate-200 truncate">{curPresskit}</span>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover/link:text-pink-400 transition-colors shrink-0" />
                        </a>
                      )
                    ) : (
                      <div className="p-3.5 bg-rose-500/5 border border-rose-500/10 rounded-2xl flex items-center justify-between">
                        <span className="text-xs text-rose-400/80 font-bold italic">Não fornecido</span>
                        <span className="text-[8px] bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest shrink-0">Pendente</span>
                      </div>
                    )}
                  </div>

                  {/* 2 - Logos Obrigatórios */}
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                      Logos Obrigatórios {isVersusCard && `(${cardTab === 2 ? 'DJ 2' : 'DJ 1'})`}
                    </p>
                    {curHasMandatory ? (
                      <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 space-y-2">
                        {curAgencies && curAgencies.length > 0 && curAgencies.some(a => a.name) && (
                          <div className="space-y-1">
                            {curAgencies.map((agency, i) => agency.name && (
                              <div key={i} className="text-xs flex items-center justify-between font-bold text-slate-200 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-1.5">
                                <span className="truncate">{agency.name}</span>
                                {agency.link && (
                                  <a 
                                    href={agency.link} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[10px] text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-0.5"
                                  >
                                    Logo <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {curLabels && curLabels.length > 0 && curLabels.some(l => l.name) && (
                          <div className="space-y-1">
                            {curLabels.map((label, i) => label.name && (
                              <div key={i} className="text-xs flex items-center justify-between font-bold text-slate-200 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-1.5">
                                <span className="truncate">{label.name}</span>
                                {label.link && (
                                  <a 
                                    href={label.link} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[10px] text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-0.5"
                                  >
                                    Logo <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                        <p className="text-xs text-slate-500 font-bold italic">Nenhum logo obrigatório exigido</p>
                      </div>
                    )}
                  </div>

                  {/* 3 - Foto Flyer e Vídeo Motion */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                        <Image className="w-3.5 h-3.5 text-blue-400" />
                        Foto Flyer
                      </p>
                      {curFlyer ? (
                        <div className="bg-white/5 border border-white/10 p-3 rounded-2xl flex flex-col justify-between h-[80px]">
                          <p className="text-xs font-bold text-slate-200 line-clamp-2" title={curFlyer}>{curFlyer}</p>
                          {curFlyer.startsWith('http') && (
                            <a 
                              href={curFlyer} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 font-bold mt-1 max-w-max"
                            >
                              Acessar <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl flex items-center justify-center h-[80px] border-dashed">
                          <span className="text-xs text-slate-600 font-bold italic">Pendente</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-teal-400" />
                        Vídeo Motion
                      </p>
                      {curVideo ? (
                        <div className="bg-white/5 border border-white/10 p-3 rounded-2xl flex flex-col justify-between h-[80px]">
                          <p className="text-xs font-bold text-slate-200 line-clamp-2" title={curVideo}>{curVideo}</p>
                          {curVideo.startsWith('http') && (
                            <a 
                              href={curVideo} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] text-teal-400 hover:text-teal-300 flex items-center gap-0.5 font-bold mt-1 max-w-max"
                            >
                              Acessar <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl flex items-center justify-center h-[80px] border-dashed">
                          <span className="text-xs text-slate-600 font-bold italic">Pendente</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4 - Trilha de Entrada */}
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-pink-400" />
                      Música de Entrada {isVersusCard && `(${cardTab === 2 ? 'DJ 2' : 'DJ 1'})`}
                    </p>
                    {curMusicName ? (
                      <div className="p-4 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-[1.5rem] border border-white/5 relative overflow-hidden group/track">
                        <div className="flex items-center justify-between relative z-10">
                          <div className="space-y-1 select-none pr-3 min-w-0">
                            <p className="text-sm font-black text-white truncate max-w-[200px]" title={curMusicName}>{curMusicName}</p>
                            <div className="flex items-center space-x-2 text-slate-400">
                              <Clock className="w-3 h-3 text-purple-400 animate-pulse" />
                              <span className="text-[10px] font-black uppercase">{curMusicDuration || "Duração livre"}</span>
                            </div>
                          </div>
                          {curMusicUrl && (
                            <a 
                              href={curMusicUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              onClick={(e) => e.stopPropagation()}
                              className="hover:scale-110 transition-transform shrink-0"
                            >
                              <Button size="icon" variant="ghost" className="rounded-full bg-white/10 hover:bg-pink-500 hover:text-white transition-all shadow-lg w-9 h-9">
                                <Music className="w-4 h-4" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl border-dashed py-3 flex flex-col items-center justify-center space-y-0.5 text-slate-600">
                        <p className="text-xs font-bold italic text-slate-500">Nenhuma trilha fornecida</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {assets.length === 0 && (
            <div className="col-span-full h-64 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center space-y-4 text-slate-600 bg-white/5">
              <Music className="w-12 h-12 opacity-20 text-purple-500" />
              <p className="italic font-bold tracking-tight">Nenhum DJ ou Versus cadastrado para este evento.</p>
            </div>
          )}
        </div>
      ) : (
        /* Calendar View */
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white/5 border border-white/5 rounded-[2rem] p-4 backdrop-blur-md">
            <Button variant="ghost" onClick={prevMonth} className="text-white hover:bg-white/10 rounded-xl">Anterior</Button>
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white italic">{monthName}</h3>
            <Button variant="ghost" onClick={nextMonth} className="text-white hover:bg-white/10 rounded-xl">Próximo</Button>
          </div>

          <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
            <div className="grid grid-cols-7 gap-2 min-w-[750px] lg:min-w-0">
              {dayNames.map(day => (
                <div key={day} className="text-center py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">
                  {day}
                </div>
              ))}
              {calendarDays.map((date, idx) => {
                if (!date) return <div key={`empty-${idx}`} className="bg-transparent h-40" />;
                
                const dateStr = date.toISOString().split('T')[0];
                const dayAssets = filteredAssets.filter(a => a.artDeadline === dateStr);
                const isToday = new Date().toDateString() === date.toDateString();

                return (
                  <div 
                    key={dateStr} 
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, date)}
                    className={cn(
                      "min-h-40 bg-white/5 border border-white/5 rounded-3xl p-3 space-y-2 transition-all hover:bg-white/10",
                      isToday && "border-purple-500/50 bg-purple-500/5"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={cn(
                        "text-xs font-black italic",
                        isToday ? "text-purple-400" : "text-slate-500"
                      )}>
                        {date.getDate()}
                      </span>
                      {dayAssets.length > 0 && (
                        <span className="bg-pink-500 text-[8px] font-black px-1.5 py-0.5 rounded-full text-white uppercase flex items-center justify-center">
                          {dayAssets.length}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 overflow-y-auto max-h-[120px] scrollbar-hide">
                      {dayAssets.map(asset => (
                        <div 
                          key={asset.id} 
                          draggable
                          onDragStart={(e) => handleDragStart(e, asset.id)}
                          onClick={() => handleOpenView(asset)}
                          className={cn(
                            "border p-2 rounded-xl cursor-grab active:cursor-grabbing transition-colors group/item text-left",
                            asset.isVersus 
                              ? "bg-pink-500/10 border-pink-500/20 hover:bg-pink-500/20" 
                              : "bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20"
                          )}
                        >
                          <p className="text-[9px] font-black text-white uppercase tracking-tight leading-tight truncate">
                            {asset.name} {asset.isVersus && `VS ${asset.dj2Name || ''}`}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Disc className="w-2 h-2 text-indigo-400" />
                            <span className="text-[8px] text-slate-400 font-bold italic truncate">Arte Pendente</span>
                          </div>
                        </div>
                      ))}
                      {dayAssets.length === 0 && (
                        <div className="h-full flex items-center justify-center pt-8">
                          <div className="w-1 h-1 rounded-full bg-white/5" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
