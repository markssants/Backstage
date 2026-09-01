import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Upload, FileText, X, Image, ExternalLink, 
  Loader2, Check, Paperclip, Sparkles, Link2 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface ReceiptData {
  url: string;
  name: string;
  type?: 'image' | 'pdf' | 'file';
  size?: number;
}

interface PaymentReceiptUploaderProps {
  receipt: ReceiptData | null;
  onChange: (receipt: ReceiptData | null) => void;
  onPreview?: () => void;
}

export function PaymentReceiptUploader({
  receipt,
  onChange,
  onPreview
}: PaymentReceiptUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLinkMode, setIsLinkMode] = useState(false);
  const [externalUrl, setExternalUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Check size limit (e.g. 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error("O arquivo é muito grande (limite: 20MB).");
      return;
    }

    setUploading(true);
    setProgress(0);

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const type: 'image' | 'pdf' | 'file' = isImage ? 'image' : isPdf ? 'pdf' : 'file';

    try {
      const url = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/upload?filename=${encodeURIComponent(file.name)}`);

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setProgress(percent);
          }
        });

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data.url);
            } catch (err) {
              reject(new Error("Resposta inválida do servidor"));
            }
          } else {
            reject(new Error(`Erro no upload (${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error("Falha na conexão de rede"));
        xhr.send(file);
      });

      onChange({
        url,
        name: file.name,
        type,
        size: file.size
      });

      toast.success("Comprovante anexado com sucesso!");
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Erro ao realizar upload do comprovante.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          handleFileUpload(file);
          break;
        }
      }
    }
  };

  const handleAddExternalLink = () => {
    if (!externalUrl.trim()) return;
    const url = externalUrl.trim();
    const isImage = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url);
    const isPdf = /\.pdf$/i.test(url);

    onChange({
      url,
      name: 'Comprovante_Externo',
      type: isImage ? 'image' : isPdf ? 'pdf' : 'file'
    });
    setExternalUrl('');
    setIsLinkMode(false);
    toast.success("Link do comprovante anexado!");
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3" onPaste={handlePaste} tabIndex={0}>
      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
          Comprovante / Print do Pagamento
        </label>
        
        {!receipt && (
          <button
            type="button"
            onClick={() => setIsLinkMode(!isLinkMode)}
            className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
          >
            <Link2 className="w-3 h-3" />
            {isLinkMode ? "Enviar Arquivo/Print" : "Colar Link Externo"}
          </button>
        )}
      </div>

      {receipt?.url ? (
        /* Attached Receipt Preview Card */
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3 flex items-center justify-between gap-3 group relative overflow-hidden transition-all hover:border-cyan-500/30">
          <div className="flex items-center space-x-3 min-w-0">
            {receipt.type === 'image' || (!receipt.type && !receipt.url.endsWith('.pdf')) ? (
              <div 
                onClick={onPreview}
                className="w-12 h-12 rounded-xl bg-black/40 border border-white/10 overflow-hidden shrink-0 cursor-pointer relative group/thumb"
                title="Clique para ampliar"
              >
                <img 
                  src={receipt.url} 
                  alt={receipt.name} 
                  className="w-full h-full object-cover transition-transform group-hover/thumb:scale-110" 
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                  <Image className="w-4 h-4 text-white" />
                </div>
              </div>
            ) : (
              <div 
                onClick={onPreview}
                className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 cursor-pointer"
              >
                <FileText className="w-6 h-6" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="font-bold text-xs text-white truncate group-hover:text-cyan-300 transition-colors">
                {receipt.name || "Comprovante anexado"}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center">
                  <Check className="w-3 h-3 mr-0.5" /> Anexado
                </span>
                {receipt.size && (
                  <span className="text-[10px] text-slate-500 font-medium">
                    &bull; {formatFileSize(receipt.size)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            {onPreview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onPreview}
                className="h-8 px-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg text-xs"
                title="Visualizar Comprovante"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              className="h-8 px-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg text-xs"
              title="Remover comprovante"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : isLinkMode ? (
        /* External Link Input */
        <div className="flex items-center gap-2 animate-in fade-in duration-200">
          <Input
            type="url"
            placeholder="https://drive.google.com/... ou URL do comprovante"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            className="rounded-2xl bg-white/5 border-white/10 text-white h-12 text-xs"
          />
          <Button
            type="button"
            onClick={handleAddExternalLink}
            className="h-12 px-4 rounded-2xl bg-cyan-500 hover:bg-cyan-600 font-bold text-xs text-white shrink-0"
          >
            Anexar
          </Button>
        </div>
      ) : (
        /* Dropzone / Upload Box */
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 relative overflow-hidden group",
            isDragOver 
              ? "border-cyan-400 bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.2)]" 
              : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
            className="hidden"
            disabled={uploading}
          />

          {uploading ? (
            <div className="space-y-2 w-full max-w-xs py-2">
              <div className="flex items-center justify-center gap-2 text-cyan-400 font-bold text-xs">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Enviando comprovante... {progress}%</span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-pink-500 h-full transition-all duration-200" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-cyan-400 group-hover:scale-110 group-hover:border-cyan-500/30 transition-all mb-2">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-white mb-0.5">
                Clique para selecionar ou arraste o print aqui
              </p>
              <p className="text-[10px] text-slate-400">
                Formatos: PNG, JPG, WEBP, PDF &bull; Suporta colar direto (<kbd className="px-1 py-0.5 bg-white/10 rounded text-[9px] font-mono">Ctrl+V</kbd>)
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
