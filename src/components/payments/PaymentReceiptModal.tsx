import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PaymentItem, PaymentReceipt } from "../../types";
import { 
  FileText, Download, ExternalLink, X, Eye, 
  RotateCw, ZoomIn, ZoomOut, CheckCircle2, Calendar, 
  Trash2, Upload, Loader2, Sparkles 
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PaymentReceiptModalProps {
  payment: PaymentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleteReceipt?: (payment: PaymentItem, receiptId?: string) => Promise<void>;
  onUploadNewReceipt?: (payment: PaymentItem, file: File) => Promise<void>;
}

export function PaymentReceiptModal({
  payment,
  isOpen,
  onClose,
  onDeleteReceipt,
  onUploadNewReceipt
}: PaymentReceiptModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [activeReceiptIndex, setActiveReceiptIndex] = useState(0);

  if (!payment) return null;

  // Aggregate receipts
  const receiptsList: PaymentReceipt[] = payment.receipts && payment.receipts.length > 0
    ? payment.receipts
    : payment.receiptUrl
      ? [{
          id: 'primary',
          url: payment.receiptUrl,
          name: payment.receiptName || 'Comprovante_de_Pagamento',
          type: payment.receiptType || (payment.receiptUrl.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image')
        }]
      : [];

  const currentReceipt = receiptsList[activeReceiptIndex] || receiptsList[0];
  const hasReceipt = Boolean(currentReceipt?.url);
  const isPdf = currentReceipt?.url?.toLowerCase().includes('.pdf') || currentReceipt?.type === 'pdf';

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleResetView = () => {
    setZoom(1);
    setRotation(0);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadNewReceipt) return;
    setIsUploading(true);
    try {
      await onUploadNewReceipt(payment, file);
      handleResetView();
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) { handleResetView(); onClose(); } }}>
      <DialogContent className="rounded-3xl max-w-[95vw] sm:max-w-[750px] w-full glass border-white/10 text-slate-100 p-0 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-white/10 bg-white/[0.02] flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                Comprovante de Pagamento
                {payment.status === 'paid' && (
                  <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Pago
                  </span>
                )}
              </DialogTitle>
              <p className="text-xs text-slate-400 font-medium">
                {payment.description} &bull; <strong className="text-white">R$ {payment.amount.toLocaleString()}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {hasReceipt && currentReceipt.url && (
              <>
                <a
                  href={currentReceipt.url}
                  download={currentReceipt.name || `comprovante_${payment.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                  title="Baixar Comprovante"
                >
                  <Download className="w-4 h-4" />
                </a>
                <a
                  href={currentReceipt.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                  title="Abrir em Nova Aba"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </>
            )}
          </div>
        </DialogHeader>

        {/* Multiple Receipts Selector (if more than 1) */}
        {receiptsList.length > 1 && (
          <div className="px-6 py-2.5 bg-black/20 border-b border-white/5 flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider shrink-0">Anexos:</span>
            {receiptsList.map((r, i) => (
              <button
                key={r.id || i}
                onClick={() => { setActiveReceiptIndex(i); handleResetView(); }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  activeReceiptIndex === i 
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' 
                    : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                Comprovante #{i + 1}
              </button>
            ))}
          </div>
        )}

        {/* Content Preview Canvas */}
        <div className="relative flex-1 bg-black/40 min-h-[340px] max-h-[58vh] overflow-hidden flex items-center justify-center p-4">
          {hasReceipt ? (
            isPdf ? (
              <div className="w-full h-full min-h-[350px] flex flex-col items-center justify-center bg-slate-900/60 rounded-2xl p-6 border border-white/10 text-center">
                <FileText className="w-16 h-16 text-cyan-400 mb-4 animate-pulse" />
                <p className="font-bold text-white text-base mb-1">{currentReceipt.name || 'Documento PDF'}</p>
                <p className="text-xs text-slate-400 mb-6 max-w-sm">
                  Documento em formato PDF anexado como comprovante de pagamento.
                </p>
                <div className="flex gap-3">
                  <a
                    href={currentReceipt.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs transition-all shadow-lg shadow-cyan-500/20"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" /> Visualizar PDF
                  </a>
                  <a
                    href={currentReceipt.url}
                    download={currentReceipt.name || `comprovante_${payment.id}.pdf`}
                    className="inline-flex items-center px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all"
                  >
                    <Download className="w-4 h-4 mr-2" /> Baixar
                  </a>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center overflow-auto">
                <img
                  src={currentReceipt.url}
                  alt={currentReceipt.name || "Print do comprovante"}
                  className="max-h-[54vh] max-w-full object-contain rounded-xl shadow-2xl transition-transform duration-200 select-none cursor-grab active:cursor-grabbing"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'center center'
                  }}
                />
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-slate-500">
                <FileText className="w-8 h-8 opacity-40" />
              </div>
              <h4 className="text-base font-bold text-white mb-1">Nenhum comprovante anexado</h4>
              <p className="text-xs text-slate-400 max-w-xs mb-6">
                Você pode anexar um print ou arquivo do comprovante bancário deste pagamento.
              </p>
              
              <label className="inline-flex items-center justify-center px-5 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs cursor-pointer transition-all shadow-lg shadow-cyan-500/20">
                {isUploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando print...</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" /> Anexar Print Agora</>
                )}
                <input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  onChange={handleFileChange} 
                  className="hidden" 
                  disabled={isUploading}
                />
              </label>
            </div>
          )}

          {/* Floating Image Control Bar */}
          {hasReceipt && !isPdf && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-xl">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
                title="Diminuir Zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-mono font-bold text-slate-300 px-1">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-30 transition-colors"
                title="Aumentar Zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <div className="w-[1px] h-3.5 bg-white/20 mx-1" />
              <button
                type="button"
                onClick={handleRotate}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                title="Girar 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetView}
                className="text-[10px] px-2 py-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white font-bold transition-colors"
                title="Redefinir visualização"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Footer with actions & metadata */}
        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-400 flex items-center gap-3">
            {payment.paidAt && (
              <span className="flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                Pago em: {payment.paidAt.toDate ? format(payment.paidAt.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Recentemente'}
              </span>
            )}
            {currentReceipt?.name && (
              <span className="truncate max-w-[200px] text-[11px] text-slate-500" title={currentReceipt.name}>
                {currentReceipt.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {hasReceipt && onDeleteReceipt && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDeleteReceipt(payment, currentReceipt.id)}
                className="rounded-xl border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 text-xs font-bold"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Excluir Print
              </Button>
            )}

            {onUploadNewReceipt && (
              <label className="inline-flex items-center justify-center px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer transition-all border border-white/10">
                {isUploading ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Atualizando...</>
                ) : (
                  <><Upload className="w-3.5 h-3.5 mr-1.5" /> {hasReceipt ? "Trocar Comprovante" : "Anexar Print"}</>
                )}
                <input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  onChange={handleFileChange} 
                  className="hidden" 
                  disabled={isUploading}
                />
              </label>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-xl border-white/10 bg-white/5 text-slate-300 hover:text-white text-xs"
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
