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

async function makeFilePublic(fileId: string, accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("Erro ao definir as permissões do arquivo como públicas:", err);
    return false;
  }
}

async function getOrCreateBackstageFolder(accessToken: string): Promise<string> {
  // Sempre enviar arquivos direto para a pasta padrão solicitada pelo designer
  return "1qoycH41-DFLKIssqMitdWqkdHP--7LFI";
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
        xhr.open('POST', appsScriptUrl, true);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
        
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
                reject(new Error(res.message || "O Script do Google retornou erro no upload."));
              }
            } catch (err) {
              console.error("[AppsScript Fail Response]", xhr.responseText);
              reject(new Error("Resposta inválida do Script do Google. Confirme se implantou o Web App com 'Quem tem acesso: Qualquer pessoa' e se colou o link de implantação correto."));
            }
          } else {
            reject(new Error(`O Script do Google retornou erro HTTP ${xhr.status}.`));
          }
        };
        
        xhr.onerror = () => {
          reject(new Error("Não foi possível conectar ao Script do Google Drive. Verifique seu link e conexão."));
        };
        
        xhr.send(JSON.stringify({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64: base64Content
        }));
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Falha ao processar o arquivo local."));
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

  // Método padrão: Google Drive REST API direta via OAuth token
  const parentFolderId = await getOrCreateBackstageFolder(accessToken);

  // Passo 1: Criar metadados do arquivo na pasta de destino
  const metadataRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      parents: [parentFolderId],
    }),
  });

  if (!metadataRes.ok) {
    const errorText = await metadataRes.text();
    throw new Error(`Falha ao criar o arquivo no Google Drive: ${errorText}`);
  }

  const metadata = await metadataRes.json();
  const fileId = metadata.id;

  if (!fileId) {
    throw new Error("ID do arquivo criado no Google Drive não foi inicializado.");
  }

  // Passo 2: Fazer upload das mídias utilizando requisição direta
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PATCH', `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          // Passo 3: Tornar o link público de visualização herdeira
          await makeFilePublic(fileId, accessToken);
          const directUrl = `https://drive.google.com/uc?id=${fileId}&export=download&name=${encodeURIComponent(file.name)}`;
          resolve(directUrl);
        } catch (err) {
          const directUrl = `https://drive.google.com/uc?id=${fileId}&export=download&name=${encodeURIComponent(file.name)}`;
          resolve(directUrl);
        }
      } else {
        reject(new Error(`Erro de envio API: Servidor do Google retornou status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Erro de conexão com o Google Drive durante o envio."));
    };

    xhr.send(file);
  });
}
