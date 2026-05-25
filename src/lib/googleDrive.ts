import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export function getGoogleDriveFileId(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    const idParam = urlObj.searchParams.get('id');
    if (idParam) return idParam;
  } catch (e) {}
  
  let match = url.match(/[?&]id=([^&]+)/);
  if (match) return match[1];
  
  match = url.match(/\/file\/d\/([^\/]+)/);
  if (match) return match[1];

  return null;
}

export async function refreshGoogleAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.access_token || null;
    } else {
      const errText = await res.text();
      console.error("Falha ao renovar token OAuth do Google:", errText);
    }
  } catch (err) {
    console.error("Erro ao renovar token OAuth do Google:", err);
  }
  return null;
}

export async function getDriveAccessToken(): Promise<string | null> {
  try {
    const docSnap = await getDoc(doc(db, 'settings', 'google_drive'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Opção A: Google Apps Script Web App
      if (data.connectionType === 'apps_script') {
        if (data.appsScriptUrl && data.appsScriptUrl.trim() !== '') {
          return "apps_script_enabled";
        }
      }

      // Opção B: Renovação Automática (OAuth Client Credentials + Refresh Token)
      if (
        data.connectionType === 'oauth_credentials' &&
        data.clientId &&
        data.clientSecret &&
        data.refreshToken
      ) {
        // Se houver token recente (menos de 50 minutos de vida), reutiliza
        const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt || 0);
        const ageInMs = Date.now() - updatedAt.getTime();
        const maxAgeInMs = 50 * 60 * 1000; // 50 min
        
        if (data.accessToken && ageInMs < maxAgeInMs) {
          return data.accessToken;
        }
        
        console.log("Token OAuth expirado ou prestes a expirar. Renovando token automaticamente...");
        const newAccessToken = await refreshGoogleAccessToken(
          data.clientId,
          data.clientSecret,
          data.refreshToken
        );
        
        if (newAccessToken) {
          await updateDoc(doc(db, 'settings', 'google_drive'), {
            accessToken: newAccessToken,
            updatedAt: serverTimestamp()
          });
          return newAccessToken;
        }
      }

      // Caso padrão / Conexão Inicial por Popup
      return data.accessToken || null;
    }
  } catch (err) {
    console.error("Erro ao obter o token do Google Drive a partir do Firestore:", err);
  }
  return null;
}

async function uploadViaAppsScript(
  file: File,
  appsScriptUrl: string,
  onProgress: (progress: number) => void
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Content = (reader.result as string).split(',')[1];
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/gdrive-proxy', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            onProgress(Math.min(98, progress)); 
          }
        });
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              if (res.status === 'success' && res.url) {
                onProgress(100);
                resolve(res.url);
              } else {
                reject(new Error(res.error || res.message || "O Script do Google retornou erro no upload."));
              }
            } catch (err) {
              console.error("[Proxy Response Error]", xhr.responseText);
              reject(new Error("Resposta inválida do Proxy do Google Drive. Verifique a implantação do Apps Script."));
            }
          } else {
            try {
              const res = JSON.parse(xhr.responseText);
              reject(new Error(res.error || `O Servidor retornou código de erro HTTP ${xhr.status}.`));
            } catch {
              reject(new Error(`O Servidor retornou código de erro HTTP ${xhr.status}.`));
            }
          }
        };
        
        xhr.onerror = () => {
          reject(new Error("Não foi possível conectar ao servidor para fazer o upload do Drive."));
        };
        
        xhr.send(JSON.stringify({
          action: 'apps_script',
          url: appsScriptUrl,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64: base64Content
        }));
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo para upload."));
    reader.readAsDataURL(file);
  });
}

export async function uploadFileToGoogleDrive(
  file: File,
  accessToken: string,
  onProgress: (progress: number) => void
): Promise<string> {
  // Se estiver usando o método do Google Apps Script
  if (accessToken === "apps_script_enabled") {
    const docSnap = await getDoc(doc(db, 'settings', 'google_drive'));
    const appsScriptUrl = docSnap.exists() ? docSnap.data().appsScriptUrl : null;
    if (!appsScriptUrl) {
      throw new Error("URL do Google Apps Script não foi configurada nas configurações do sistema.");
    }
    return uploadViaAppsScript(file, appsScriptUrl, onProgress);
  }

  // Método padrão: Google Drive REST API direta via OAuth token => Proxy em server.ts para resolver CORS
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Content = (reader.result as string).split(',')[1];
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/gdrive-proxy', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            onProgress(Math.min(98, progress)); 
          }
        });
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              if (res.status === 'success' && res.url) {
                onProgress(100);
                resolve(res.url);
              } else {
                reject(new Error(res.error || res.message || "Erro no upload via proxy."));
              }
            } catch (err) {
              console.error("[Proxy Response Error]", xhr.responseText);
              reject(new Error("Resposta inválida do Proxy do Google Drive."));
            }
          } else {
            try {
              const res = JSON.parse(xhr.responseText);
              reject(new Error(res.error || `O Servidor retornou código de erro HTTP ${xhr.status}.`));
            } catch {
              reject(new Error(`O Servidor retornou código de erro HTTP ${xhr.status}.`));
            }
          }
        };
        
        xhr.onerror = () => {
          reject(new Error("Não foi possível conectar ao servidor para fazer o upload do Drive."));
        };
        
        xhr.send(JSON.stringify({
          action: 'google_drive',
          accessToken,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64: base64Content
        }));
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo para upload."));
    reader.readAsDataURL(file);
  });
}
