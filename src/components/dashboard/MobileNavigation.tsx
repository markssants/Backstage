import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, 
  Palette, 
  Music, 
  FolderOpen, 
  CreditCard, 
  Gavel,
  MoreHorizontal, 
  User, 
  LogOut, 
  X, 
  Shield, 
  ChevronRight,
  Sparkles
} from "lucide-react";
import { ViewType, UserProfile } from "../../types";
import { cn } from "@/lib/utils";

interface MobileNavigationProps {
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  profile: UserProfile;
  onLogout: () => void;
}

export function MobileNavigation({ activeView, setActiveView, profile, onLogout }: MobileNavigationProps) {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // Core tabs requested directly by the user:
  const tabs = [
    { id: 'overview' as ViewType, label: 'Resumo', icon: LayoutDashboard },
    { id: 'arts' as ViewType, label: 'Artes', icon: Palette },
    { id: 'dj' as ViewType, label: 'DJs', icon: Music },
    { id: 'files' as ViewType, label: 'Arquivos', icon: FolderOpen },
    { id: 'payments' as ViewType, label: 'Pagamentos', icon: CreditCard },
    { id: 'docs' as ViewType, label: 'Corregedoria', icon: Gavel },
  ];

  const handleTabClick = (tabId: ViewType) => {
    setActiveView(tabId);
    setIsMoreMenuOpen(false);
  };

  const handleMoreItemClick = (viewId: ViewType) => {
    setActiveView(viewId);
    setIsMoreMenuOpen(false);
  };

  // Determine if active view is within the "More" items (Profile, About, Admin)
  const isMoreActive = ['profile', 'about', 'admin'].includes(activeView);

  return (
    <>
      {/* Persistent Bottom Bar (Aesthetic iOS Integration) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#060310]/95 backdrop-blur-2xl border-t border-white/5 pb-4 pt-1.5 px-1 sm:px-3 flex justify-between items-center shadow-[0_-8px_30px_rgba(0,0,0,0.8)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeView === tab.id && !isMoreMenuOpen;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className="flex flex-col items-center justify-center flex-1 py-1 relative active:scale-90 transition-all cursor-pointer min-w-0"
            >
              <div 
                className={cn(
                  "relative p-1 rounded-xl flex items-center justify-center transition-all duration-300",
                  isActive 
                    ? "text-pink-500 scale-105 bg-pink-500/10" 
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                <Icon className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px]" />
                {isActive && (
                  <motion.div 
                    layoutId="mobile-glow"
                    className="absolute -inset-1 rounded-xl bg-pink-500/10 blur-[5px]"
                  />
                )}
              </div>
              <span 
                className={cn(
                  "text-[8px] min-[360px]:text-[9px] min-[400px]:text-[10px] font-bold tracking-tight mt-0.5 transition-colors text-center truncate w-full px-0.5",
                  isActive ? "text-pink-400 font-black" : "text-slate-500"
                )}
              >
                {tab.label}
              </span>
              
              {isActive && (
                <motion.div 
                  layoutId="mobile-dot"
                  className="w-1 h-1 rounded-full bg-pink-500 mt-0.5" 
                />
              )}
            </button>
          );
        })}

        {/* MORE BUTTON */}
        <button
          onClick={() => setIsMoreMenuOpen(true)}
          className="flex flex-col items-center justify-center flex-1 py-1 relative active:scale-95 transition-all cursor-pointer min-w-0"
        >
          <div 
            className={cn(
              "relative p-1 rounded-xl flex items-center justify-center transition-all duration-300",
              isMoreActive || isMoreMenuOpen
                ? "text-pink-500 scale-105 bg-pink-500/10" 
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            <MoreHorizontal className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px]" />
            {(isMoreActive || isMoreMenuOpen) && (
              <motion.div 
                layoutId="mobile-glow"
                className="absolute -inset-1 rounded-xl bg-pink-500/10 blur-[5px]"
              />
            )}
          </div>
          <span 
            className={cn(
              "text-[8px] min-[360px]:text-[9px] min-[400px]:text-[10px] font-bold tracking-tight mt-0.5 transition-colors text-center truncate w-full px-0.5",
              isMoreActive || isMoreMenuOpen ? "text-pink-400 font-black" : "text-slate-500"
            )}
          >
            Mais
          </span>
          {(isMoreActive || isMoreMenuOpen) && (
            <motion.div 
              layoutId="mobile-dot"
              className="w-1 h-1 rounded-full bg-pink-500 mt-0.5" 
            />
          )}
        </button>
      </div>

      {/* Slide-Up Bottom Drawer Sheet (iOS Style) */}
      <AnimatePresence>
        {isMoreMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMoreMenuOpen(false)}
              className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-md"
            />

            {/* Bottom Drawer */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="md:hidden fixed bottom-12 left-0 right-0 z-50 bg-[#0d071f]/95 border-t border-white/10 rounded-t-[2rem] px-6 pb-20 pt-4 flex flex-col shadow-[0_-15px_40px_rgba(0,0,0,0.8)] max-h-[85vh] overflow-y-auto"
            >
              {/* Pull handle indicator */}
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6 shrink-0 cursor-pointer" onClick={() => setIsMoreMenuOpen(false)} />

              <div className="flex items-center justify-between mb-6 shrink-0">
                <h3 className="text-base font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pink-500" />
                  Minha Conta & Opções
                </h3>
                <button 
                  onClick={() => setIsMoreMenuOpen(false)} 
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* User Profile Card within Menu */}
              <div 
                onClick={() => handleMoreItemClick('profile')}
                className={cn(
                  "flex items-center bg-white/5 border border-white/5 p-4 rounded-2xl mb-6 cursor-pointer active:scale-[0.98] transition-all",
                  activeView === 'profile' && "border-pink-500/30 bg-pink-500/10"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-white mr-4 shadow-lg shrink-0",
                  activeView === 'profile' ? "bg-pink-500 scale-105" : "bg-slate-800 border-2 border-pink-500/30"
                )}>
                  {profile.role === 'designer' ? <Palette className="w-4 h-4 text-current" /> : <User className="w-4 h-4 text-current" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{profile.name}</p>
                  <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5">
                    {profile.role === 'designer' ? 'Designer' : 'Contratante'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500" />
              </div>

              {/* Extras List */}
              <div className="space-y-2 mb-6">
                {/* 1. Profile option */}
                <button
                  onClick={() => handleMoreItemClick('profile')}
                  className={cn(
                    "w-full flex items-center py-3 px-4 rounded-xl active:scale-[0.99] transition-all cursor-pointer text-left font-bold text-xs sm:text-sm",
                    activeView === 'profile' 
                      ? "bg-pink-500/10 border border-pink-500/20 text-white" 
                      : "bg-white/5 border border-transparent text-slate-300 hover:bg-white/10"
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center mr-3 shrink-0",
                    activeView === 'profile' ? "bg-pink-500 text-white" : "bg-white/10 text-slate-400"
                  )}>
                    <User className="w-4 h-4" />
                  </div>
                  <span className="flex-1">Editar Meu Perfil</span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>

                {/* 2. Sobre option */}
                <button
                  onClick={() => handleMoreItemClick('about')}
                  className={cn(
                    "w-full flex items-center py-3 px-4 rounded-xl active:scale-[0.99] transition-all cursor-pointer text-left font-bold text-xs sm:text-sm",
                    activeView === 'about' 
                      ? "bg-pink-500/10 border border-pink-500/20 text-white" 
                      : "bg-white/5 border border-transparent text-slate-300 hover:bg-white/10"
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center mr-3 shrink-0",
                    activeView === 'about' ? "bg-pink-500 text-white" : "bg-white/10 text-slate-400"
                  )}>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="flex-1">Sobre o Backstage</span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>

                {/* 3. Admin Panel option */}
                {profile.email === "beysarts@gmail.com" && (
                  <button
                    onClick={() => handleMoreItemClick('admin')}
                    className={cn(
                      "w-full flex items-center py-3 px-4 rounded-xl active:scale-[0.99] transition-all cursor-pointer text-left font-bold text-xs sm:text-sm",
                      activeView === 'admin' 
                        ? "bg-pink-500/10 border border-pink-500/20 text-white" 
                        : "bg-white/5 border border-transparent text-slate-300 hover:bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center mr-3 shrink-0",
                      activeView === 'admin' ? "bg-pink-500 text-white" : "bg-white/10 text-slate-400"
                    )}>
                      <Shield className="w-4 h-4" />
                    </div>
                    <span className="flex-1 font-black text-rose-300">Painel Geral Admin</span>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>
                )}
              </div>

              {/* Logout option */}
              <div className="border-t border-white/5 pt-4 mt-auto">
                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center justify-between py-3.5 px-4 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 text-red-400 font-bold text-xs sm:text-sm transition-all cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex items-center">
                    <LogOut className="w-4 h-4 mr-3" />
                    <span>Sair da Conta (Logout)</span>
                  </div>
                  <span className="text-[9px] font-black tracking-widest opacity-60">v2.9.9</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
