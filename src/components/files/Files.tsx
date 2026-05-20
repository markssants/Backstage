import { EventProject, UserProfile } from "../../types";
import { Card, CardContent } from "@/components/ui/card";
import { FolderOpen, ExternalLink, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FilesProps {
  event: EventProject;
  profile: UserProfile;
}

export function Files({ event }: FilesProps) {
  // Extract folder ID from Google Drive URL
  const getEmbedUrl = (url: string | undefined) => {
    if (!url) return null;
    
    const folderIdMatch = url.match(/folders\/([a-zA-Z0-9-_]+)/);
    if (folderIdMatch && folderIdMatch[1]) {
      // Using hl=pt-BR and explicit #grid for grid view
      return `https://drive.google.com/embeddedfolderview?id=${folderIdMatch[1]}&hl=pt-BR#grid`;
    }
    
    return null;
  };

  const embedUrl = getEmbedUrl(event.driveUrl);

  return (
    <div className="space-y-8 p-6 font-sans">
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
        <div className="space-y-1">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-blue-400">Arquivos do Evento</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic flex items-center">
            <FolderOpen className="w-3 h-3 mr-2 text-blue-500/50" />
            Navegação oficial integrada ao Google Drive
          </p>
        </div>
      </div>

      <Card className="rounded-[2.5rem] border-white/5 bg-slate-900 shadow-2xl overflow-hidden border min-h-[550px] flex flex-col">
        <CardContent className="p-0 flex-grow h-full bg-slate-900">
          {embedUrl ? (
            <div className="w-full h-full min-h-[550px] relative overflow-hidden rounded-[2.5rem]">
              <iframe
                src={embedUrl}
                width="100%"
                height="550px"
                className="rounded-[2.5rem] border-none invert hue-rotate-180 contrast-125"
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                title="Google Drive"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[550px] text-center space-y-6 p-12">
              <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center border border-blue-500/20">
                <ShieldAlert className="w-10 h-10 text-blue-500/50" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white tracking-tight uppercase italic">Link do Drive não configurado</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto font-medium leading-relaxed italic">
                  Adicione o link da pasta do Google Drive nas configurações do evento para visualizar os arquivos de forma embutida.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
