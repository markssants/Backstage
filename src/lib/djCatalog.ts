import { collection, query, limit, doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { DjCatalogItem, DjAsset } from '../types';
import { sanitizeForFirestore } from './error-handler';

const LOCAL_STORAGE_CATALOG_KEY = 'beys_dj_catalog_cache_v2';

export function normalizeDjName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getDjCatalogDocId(name: string): string {
  const norm = normalizeDjName(name).replace(/\s+/g, '_');
  return norm ? `dj_${norm}` : `dj_${Date.now()}`;
}

export function getLocalDjCatalog(): DjCatalogItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CATALOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Erro ao ler catálogo do cache local:", e);
  }
  return [];
}

export function setLocalDjCatalog(items: DjCatalogItem[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_CATALOG_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("Erro ao gravar catálogo no cache local:", e);
  }
}

/**
 * Salva ou atualiza os dados completos de um DJ no Catálogo Global e no LocalStorage.
 * Executa atualização local instantânea e sincroniza com o Firestore em background sem bloquear.
 */
export async function saveDjToCatalog(djData: Partial<DjCatalogItem>) {
  if (!djData.name || !djData.name.trim()) return;

  const rawName = djData.name.trim();
  const normName = normalizeDjName(rawName);
  const docId = getDjCatalogDocId(rawName);

  const cleanPayload: DjCatalogItem = {
    id: docId,
    name: rawName,
    normalizedName: normName,
    updatedAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    presskitUrl: djData.presskitUrl || '',
    presskitType: djData.presskitType || 'link',
    presskitStatus: djData.presskitStatus || 'pending',
    hasMandatoryLogo: !!djData.hasMandatoryLogo,
    agencies: djData.agencies || (djData.agencyInfo ? [{ name: djData.agencyInfo, link: '', type: 'link' }] : []),
    agencyInfo: djData.agencyInfo || '',
    hasRecordLabel: !!djData.hasRecordLabel,
    labels: djData.labels || (djData.labelInfo ? [{ name: djData.labelInfo, link: '', type: 'link' }] : []),
    labelInfo: djData.labelInfo || '',
    hasVisualMaterial: !!(djData.flyerPhoto || djData.animationVideo || djData.hasVisualMaterial),
    visualMaterialType: djData.visualMaterialType || 'both',
    flyerPhoto: djData.flyerPhoto || '',
    flyerPhotoType: djData.flyerPhotoType || 'link',
    animationVideo: djData.animationVideo || '',
    animationVideoType: djData.animationVideoType || 'link',
    hasPlaylist: !!(djData.musicName || djData.musicUrl || djData.hasPlaylist),
    musicName: djData.musicName || '',
    musicUrl: djData.musicUrl || '',
    musicUrlType: djData.musicUrlType || 'link',
    musicDuration: djData.musicDuration || '',
  };

  // 1. Atualiza cache local imediatamente (0ms de latência)
  const localList = getLocalDjCatalog();
  const existingIdx = localList.findIndex(x => (x.normalizedName || normalizeDjName(x.name)) === normName);
  if (existingIdx >= 0) {
    localList[existingIdx] = { ...localList[existingIdx], ...cleanPayload };
  } else {
    localList.unshift(cleanPayload);
  }
  setLocalDjCatalog(localList);

  // 2. Sincroniza com o Firestore na coleção global de DJs em background (sem bloquear UI)
  const docRef = doc(db, 'djs_catalog', docId);
  setDoc(docRef, sanitizeForFirestore({
    ...cleanPayload,
    updatedAt: serverTimestamp(),
    lastUsedAt: serverTimestamp(),
  }), { merge: true }).catch((err) => {
    console.warn("Aviso ao persistir DJ no Firestore djs_catalog:", err);
  });
}

/**
 * Registra múltiplos DJ Assets no catálogo local (em memória e cache).
 * NÃO realiza escritas no Firestore para evitar tempestade de requisições.
 */
export function registerDjsFromAssets(assets: DjAsset[]) {
  if (!assets || assets.length === 0) return;
  const localList = getLocalDjCatalog();
  let hasChanges = false;

  const addOrUpdateLocal = (rawName: string, partial: Partial<DjCatalogItem>) => {
    if (!rawName || !rawName.trim()) return;
    const name = rawName.trim();
    const norm = normalizeDjName(name);
    const existingIdx = localList.findIndex(x => (x.normalizedName || normalizeDjName(x.name)) === norm);
    const item: DjCatalogItem = {
      id: getDjCatalogDocId(name),
      name,
      normalizedName: norm,
      updatedAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      presskitUrl: partial.presskitUrl || '',
      presskitType: partial.presskitType || 'link',
      presskitStatus: partial.presskitStatus || 'pending',
      hasMandatoryLogo: !!partial.hasMandatoryLogo,
      agencies: partial.agencies || [],
      agencyInfo: partial.agencyInfo || '',
      hasRecordLabel: !!partial.hasRecordLabel,
      labels: partial.labels || [],
      labelInfo: partial.labelInfo || '',
      hasVisualMaterial: !!partial.hasVisualMaterial,
      visualMaterialType: partial.visualMaterialType || 'both',
      flyerPhoto: partial.flyerPhoto || '',
      flyerPhotoType: partial.flyerPhotoType || 'link',
      animationVideo: partial.animationVideo || '',
      animationVideoType: partial.animationVideoType || 'link',
      hasPlaylist: !!partial.hasPlaylist,
      musicName: partial.musicName || '',
      musicUrl: partial.musicUrl || '',
      musicUrlType: partial.musicUrlType || 'link',
      musicDuration: partial.musicDuration || '',
    };

    if (existingIdx >= 0) {
      localList[existingIdx] = { ...localList[existingIdx], ...item };
    } else {
      localList.push(item);
    }
    hasChanges = true;
  };

  for (const a of assets) {
    if (a.name && a.name.trim()) {
      addOrUpdateLocal(a.name, {
        presskitUrl: a.presskitUrl || '',
        presskitType: a.presskitType || 'link',
        presskitStatus: a.presskitStatus || 'pending',
        hasMandatoryLogo: !!a.hasMandatoryLogo,
        agencies: a.agencies || (a.agencyInfo ? [{ name: a.agencyInfo, link: '', type: 'link' }] : []),
        hasRecordLabel: !!(a.labels && a.labels.length > 0),
        labels: a.labels || (a.labelInfo ? [{ name: a.labelInfo, link: '', type: 'link' }] : []),
        hasVisualMaterial: !!(a.flyerPhoto || a.animationVideo),
        visualMaterialType: a.visualMaterialType || 'both',
        flyerPhoto: a.flyerPhoto || '',
        flyerPhotoType: a.flyerPhotoType || 'link',
        animationVideo: a.animationVideo || '',
        animationVideoType: a.animationVideoType || 'link',
        hasPlaylist: !!(a.musicName || a.musicUrl),
        musicName: a.musicName || '',
        musicUrl: a.musicUrl || '',
        musicUrlType: a.musicUrlType || 'link',
        musicDuration: a.musicDuration || '',
      });
    }
    if (a.isVersus && a.dj2Name && a.dj2Name.trim()) {
      addOrUpdateLocal(a.dj2Name, {
        presskitUrl: a.dj2PresskitUrl || '',
        presskitType: a.dj2PresskitType || 'link',
        presskitStatus: a.dj2PresskitUrl ? 'completed' : 'pending',
        hasMandatoryLogo: !!a.dj2HasMandatoryLogo,
        agencies: a.dj2Agencies || (a.dj2AgencyInfo ? [{ name: a.dj2AgencyInfo, link: '', type: 'link' }] : []),
        hasRecordLabel: !!(a.dj2Labels && a.dj2Labels.length > 0),
        labels: a.dj2Labels || (a.dj2LabelInfo ? [{ name: a.dj2LabelInfo, link: '', type: 'link' }] : []),
        hasVisualMaterial: !!(a.dj2FlyerPhoto || a.dj2AnimationVideo),
        visualMaterialType: a.dj2VisualMaterialType || 'both',
        flyerPhoto: a.dj2FlyerPhoto || '',
        flyerPhotoType: a.dj2FlyerPhotoType || 'link',
        animationVideo: a.dj2AnimationVideo || '',
        animationVideoType: a.dj2AnimationVideoType || 'link',
        hasPlaylist: !!(a.dj2MusicName || a.dj2MusicUrl),
        musicName: a.dj2MusicName || '',
        musicUrl: a.dj2MusicUrl || '',
        musicUrlType: a.dj2MusicUrlType || 'link',
        musicDuration: a.dj2MusicDuration || '',
      });
    }
  }

  if (hasChanges) {
    setLocalDjCatalog(localList);
  }
}

/**
 * Escuta o catálogo de DJs em tempo real no Firestore e mantém sincronizado no cache local.
 */
export function subscribeToDjCatalog(onUpdate: (catalog: DjCatalogItem[]) => void) {
  // Mapa centralizado de itens em memória
  const memoryCatalog = new Map<string, DjCatalogItem>();

  // 1. Carrega imediatamente o cache do LocalStorage (latência 0)
  const initialLocal = getLocalDjCatalog();
  for (const item of initialLocal) {
    const norm = item.normalizedName || normalizeDjName(item.name || '');
    if (norm) memoryCatalog.set(norm, item);
  }
  if (memoryCatalog.size > 0) {
    onUpdate(Array.from(memoryCatalog.values()));
  }

  let broadcastTimeout: ReturnType<typeof setTimeout> | null = null;
  const broadcastUpdates = () => {
    if (broadcastTimeout) clearTimeout(broadcastTimeout);
    broadcastTimeout = setTimeout(() => {
      const items = Array.from(memoryCatalog.values());
      setLocalDjCatalog(items);
      onUpdate(items);
    }, 50);
  };

  const processDjDoc = (d: any) => {
    if (!d || !d.name || typeof d.name !== 'string' || !d.name.trim()) return;
    const name1 = d.name.trim();
    const norm1 = normalizeDjName(name1);
    
    const existing = memoryCatalog.get(norm1);
    const item1: DjCatalogItem = {
      id: d.id || getDjCatalogDocId(name1),
      name: name1,
      normalizedName: norm1,
      updatedAt: d.updatedAt || existing?.updatedAt || new Date().toISOString(),
      lastUsedAt: d.lastUsedAt || existing?.lastUsedAt || new Date().toISOString(),
      presskitUrl: d.presskitUrl || existing?.presskitUrl || '',
      presskitType: d.presskitType || existing?.presskitType || 'link',
      presskitStatus: d.presskitStatus || existing?.presskitStatus || 'pending',
      hasMandatoryLogo: !!(d.hasMandatoryLogo ?? existing?.hasMandatoryLogo),
      agencies: d.agencies || existing?.agencies || (d.agencyInfo ? [{ name: d.agencyInfo, link: '', type: 'link' }] : []),
      agencyInfo: d.agencyInfo || existing?.agencyInfo || '',
      hasRecordLabel: !!(d.hasRecordLabel ?? (d.labels && d.labels.length > 0) ?? existing?.hasRecordLabel),
      labels: d.labels || existing?.labels || (d.labelInfo ? [{ name: d.labelInfo, link: '', type: 'link' }] : []),
      labelInfo: d.labelInfo || existing?.labelInfo || '',
      hasVisualMaterial: !!(d.flyerPhoto || d.animationVideo || d.hasVisualMaterial || existing?.hasVisualMaterial),
      visualMaterialType: d.visualMaterialType || existing?.visualMaterialType || 'both',
      flyerPhoto: d.flyerPhoto || existing?.flyerPhoto || '',
      flyerPhotoType: d.flyerPhotoType || existing?.flyerPhotoType || 'link',
      animationVideo: d.animationVideo || existing?.animationVideo || '',
      animationVideoType: d.animationVideoType || existing?.animationVideoType || 'link',
      hasPlaylist: !!(d.musicName || d.musicUrl || d.hasPlaylist || existing?.hasPlaylist),
      musicName: d.musicName || existing?.musicName || '',
      musicUrl: d.musicUrl || existing?.musicUrl || '',
      musicUrlType: d.musicUrlType || existing?.musicUrlType || 'link',
      musicDuration: d.musicDuration || existing?.musicDuration || '',
    };
    memoryCatalog.set(norm1, item1);

    // Se for atração versus com segundo DJ
    if (d.isVersus && d.dj2Name && typeof d.dj2Name === 'string' && d.dj2Name.trim()) {
      const name2 = d.dj2Name.trim();
      const norm2 = normalizeDjName(name2);
      const existing2 = memoryCatalog.get(norm2);
      const item2: DjCatalogItem = {
        id: getDjCatalogDocId(name2),
        name: name2,
        normalizedName: norm2,
        updatedAt: d.updatedAt || existing2?.updatedAt || new Date().toISOString(),
        lastUsedAt: d.lastUsedAt || existing2?.lastUsedAt || new Date().toISOString(),
        presskitUrl: d.dj2PresskitUrl || existing2?.presskitUrl || '',
        presskitType: d.dj2PresskitType || existing2?.presskitType || 'link',
        presskitStatus: d.dj2PresskitUrl ? 'completed' : (existing2?.presskitStatus || 'pending'),
        hasMandatoryLogo: !!(d.dj2HasMandatoryLogo ?? existing2?.hasMandatoryLogo),
        agencies: d.dj2Agencies || existing2?.agencies || (d.dj2AgencyInfo ? [{ name: d.dj2AgencyInfo, link: '', type: 'link' }] : []),
        agencyInfo: d.dj2AgencyInfo || existing2?.agencyInfo || '',
        hasRecordLabel: !!(d.dj2HasRecordLabel ?? (d.dj2Labels && d.dj2Labels.length > 0) ?? existing2?.hasRecordLabel),
        labels: d.dj2Labels || existing2?.labels || (d.dj2LabelInfo ? [{ name: d.dj2LabelInfo, link: '', type: 'link' }] : []),
        labelInfo: d.dj2LabelInfo || existing2?.labelInfo || '',
        hasVisualMaterial: !!(d.dj2FlyerPhoto || d.dj2AnimationVideo || existing2?.hasVisualMaterial),
        visualMaterialType: d.dj2VisualMaterialType || existing2?.visualMaterialType || 'both',
        flyerPhoto: d.dj2FlyerPhoto || existing2?.flyerPhoto || '',
        flyerPhotoType: d.dj2FlyerPhotoType || existing2?.flyerPhotoType || 'link',
        animationVideo: d.dj2AnimationVideo || existing2?.animationVideo || '',
        animationVideoType: d.dj2AnimationVideoType || existing2?.animationVideoType || 'link',
        hasPlaylist: !!(d.dj2MusicName || d.dj2MusicUrl || existing2?.hasPlaylist),
        musicName: d.dj2MusicName || existing2?.musicName || '',
        musicUrl: d.dj2MusicUrl || existing2?.musicUrl || '',
        musicUrlType: d.dj2MusicUrlType || existing2?.musicUrlType || 'link',
        musicDuration: d.dj2MusicDuration || existing2?.musicDuration || '',
      };
      memoryCatalog.set(norm2, item2);
    }
  };

  // 2. Listener centralizado da Coleção Global /djs_catalog (limitado a 300 itens recentes)
  const catalogQuery = query(collection(db, 'djs_catalog'), limit(300));
  const unsubscribeCatalog = onSnapshot(catalogQuery, (snapshot) => {
    snapshot.forEach(docSnap => {
      processDjDoc({ id: docSnap.id, ...docSnap.data() });
    });
    broadcastUpdates();
  }, (err) => {
    console.warn("Aviso ao escutar djs_catalog:", err);
  });

  return () => {
    if (broadcastTimeout) clearTimeout(broadcastTimeout);
    unsubscribeCatalog();
  };
}

/**
 * Busca e pontua correspondências no catálogo para autocompletar.
 */
export function searchDjCatalog(queryTerm: string, catalog: DjCatalogItem[]): DjCatalogItem[] {
  if (!queryTerm || !queryTerm.trim()) return [];
  const normalizedQuery = normalizeDjName(queryTerm);
  if (normalizedQuery.length === 0) return [];

  // Considera também termos sem "dj " no início se o usuário pesquisou apenas o nome
  const queryWithoutDj = normalizedQuery.replace(/^dj\s+/, '');

  return catalog
    .filter(item => {
      const norm = item.normalizedName || normalizeDjName(item.name || '');
      const normWithoutDj = norm.replace(/^dj\s+/, '');
      
      // Match se contém a query ou se o nome sem 'dj' contém a query
      return norm.includes(normalizedQuery) || 
             (queryWithoutDj.length > 0 && normWithoutDj.includes(queryWithoutDj)) ||
             norm.startsWith(normalizedQuery) ||
             normWithoutDj.startsWith(queryWithoutDj);
    })
    .sort((a, b) => {
      const normA = a.normalizedName || normalizeDjName(a.name || '');
      const normB = b.normalizedName || normalizeDjName(b.name || '');
      
      const normWithoutDjA = normA.replace(/^dj\s+/, '');
      const normWithoutDjB = normB.replace(/^dj\s+/, '');

      const exactA = normA === normalizedQuery || normWithoutDjA === queryWithoutDj;
      const exactB = normB === normalizedQuery || normWithoutDjB === queryWithoutDj;
      if (exactA && !exactB) return -1;
      if (!exactA && exactB) return 1;

      const startsA = normA.startsWith(normalizedQuery) || normWithoutDjA.startsWith(queryWithoutDj);
      const startsB = normB.startsWith(normalizedQuery) || normWithoutDjB.startsWith(queryWithoutDj);
      if (startsA && !startsB) return -1;
      if (!startsA && startsB) return 1;

      // Prioriza quem tem mais dados preenchidos (presskit, foto, música)
      const scoreA = (a.presskitUrl ? 4 : 0) + (a.flyerPhoto ? 2 : 0) + (a.musicUrl ? 2 : 0) + (a.animationVideo ? 1 : 0);
      const scoreB = (b.presskitUrl ? 4 : 0) + (b.flyerPhoto ? 2 : 0) + (b.musicUrl ? 2 : 0) + (b.animationVideo ? 1 : 0);
      return scoreB - scoreA;
    })
    .slice(0, 8);
}
