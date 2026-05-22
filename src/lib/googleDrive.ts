import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function getDriveAccessToken(): Promise<string | null> {
  try {
    const docSnap = await getDoc(doc(db, 'settings', 'google_drive'));
    if (docSnap.exists()) {
      const data = docSnap.data();
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
  const query = "name = 'Backstage' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
  
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }
  } catch (err) {
    console.error("Erro ao procurar pasta Backstage em Google Drive:", err);
  }

  // Se não foi encontrada, cria a pasta
  try {
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Backstage',
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (createRes.ok) {
      const folderMetadata = await createRes.json();
      if (folderMetadata.id) {
        // Define permissões da pasta para público ler (opcional, ajuda na herança)
        await makeFilePublic(folderMetadata.id, accessToken);
        return folderMetadata.id;
      }
    }
    const errText = await createRes.text();
    console.error("Falha ao criar pasta Backstage:", errText);
  } catch (err) {
    console.error("Erro ao criar pasta Backstage:", err);
  }
  
  throw new Error("Não foi possível localizar ou criar a pasta 'Backstage' no seu Google Drive.");
}

export async function uploadFileToGoogleDrive(
  file: File,
  accessToken: string,
  onProgress: (progress: number) => void
): Promise<string> {
  // Step 0: Obter ou criar a pasta Backstage no Google Drive
  const parentFolderId = await getOrCreateBackstageFolder(accessToken);

  // Step 1: Create the file metadata in Google Drive with the specified parent folder
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
    throw new Error("ID do arquivo criado no Google Drive não foi retornado.");
  }

  // Step 2: Upload the physical media using PATCH resumable-like request
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
          // Step 3: Make the file readable by anyone
          await makeFilePublic(fileId, accessToken);
          // Standard webContentLink format that can act as direct source for browser media elements
          const directUrl = `https://drive.google.com/uc?id=${fileId}&export=download&name=${encodeURIComponent(file.name)}`;
          resolve(directUrl);
        } catch (err) {
          // Fallback to direct url anyway
          const directUrl = `https://drive.google.com/uc?id=${fileId}&export=download&name=${encodeURIComponent(file.name)}`;
          resolve(directUrl);
        }
      } else {
        reject(new Error(`Erro de envio: Servidor retornou o status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Erro de conexão de rede durante o upload."));
    };

    xhr.send(file);
  });
}
