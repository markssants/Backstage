import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LayoutDashboard, Palette, Music, CreditCard, LogOut, Brush, Users, Gavel, FolderOpen, Shield } from "lucide-react";
import { ViewType, UserProfile } from "../../types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  profile: UserProfile;
  onLogout: () => void;
}

export function Sidebar({ activeView, setActiveView, profile, onLogout }: SidebarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const forceExpanded = activeView === 'overview';
  const isExpanded = forceExpanded || isHovered;

  const menuItems = [
    { id: 'overview' as ViewType, label: 'Resumo', icon: LayoutDashboard },
    { id: 'arts' as ViewType, label: 'Artes', icon: Palette },
    { id: 'dj' as ViewType, label: 'DJs & Presskits', icon: Music },
    { id: 'files' as ViewType, label: 'Arquivos', icon: FolderOpen },
    { id: 'payments' as ViewType, label: 'Pagamentos', icon: CreditCard },
    { id: 'docs' as ViewType, label: 'Corregedoria', icon: Gavel },
  ];

  if (profile.email === "beysarts@gmail.com") {
    menuItems.push({ id: 'admin' as ViewType, label: 'Painel Admin', icon: Shield });
  }

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isExpanded ? 260 : 88 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="hidden md:flex h-screen glass-sidebar text-slate-400 flex-col z-50 overflow-hidden shrink-0"
    >
      <div className="flex flex-col flex-1 p-4 transition-all duration-300">
        <div 
          onClick={() => setActiveView('about')}
          className="flex items-center text-white mb-10 mt-2 min-h-[40px] px-2 overflow-hidden cursor-pointer group/logo hover:opacity-80 transition-all active:scale-95"
        >
          <div className={cn(
            "w-12 h-12 bg-black rounded-2xl flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] shrink-0 mr-3 transition-transform p-0",
            activeView === 'about' && "shadow-[0_0_30px_rgba(236,72,153,0.3)] scale-110"
          )}>
            <img 
              src="https://i.ibb.co/Jw9v1n5x/b.png" 
              alt="Logo" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <AnimatePresence>
            {isExpanded && (
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className={cn(
                  "font-black tracking-tighter text-xl whitespace-nowrap overflow-hidden font-tight transition-colors",
                  activeView === 'about' ? "text-pink-500" : "group-hover/logo:text-pink-400"
                )}
              >
                Backstage
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <nav className="space-y-2 flex-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={cn(
                  "transition-all duration-300 group text-sm font-bold relative overflow-hidden flex items-center",
                  isActive 
                    ? "text-white bg-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]" 
                    : "text-slate-500 hover:text-slate-200 hover:bg-white/5",
                  "w-full px-2 py-3 rounded-2xl"
                )}
              >
                <div className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300 shrink-0 mr-3",
                  isActive ? "bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]" : "bg-white/5 text-slate-500 group-hover:bg-white/10"
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                
                <AnimatePresence>
                  {isExpanded && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {isActive && isExpanded && (
                  <motion.div 
                    layoutId="active-nav-glow"
                    className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-transparent pointer-events-none"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 mt-auto space-y-4 transition-all duration-300">
        <div 
          onClick={() => setActiveView('profile')}
          className={cn(
            "flex items-center bg-white/5 rounded-2xl border border-white/5 transition-all px-2 py-3 overflow-hidden cursor-pointer hover:bg-white/10 group/profile",
            activeView === 'profile' && "border-pink-500/30 bg-pink-500/5 shadow-[0_0_20px_rgba(236,72,153,0.1)]"
          )}
        >
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center text-slate-100 overflow-hidden shrink-0 mr-3 transition-all",
            activeView === 'profile' ? "bg-pink-500 shadow-lg scale-110" : "bg-slate-800 border-2 border-pink-500/50 group-hover/profile:border-pink-500"
          )}>
            {profile.role === 'designer' ? <Palette className="w-5 h-5 text-current" /> : <Users className="w-5 h-5 text-current" />}
          </div>
          <AnimatePresence>
            {isExpanded && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-bold text-white truncate group-hover/profile:text-pink-400 transition-colors">{profile.name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
                  {profile.role === 'designer' ? 'Designer' : 'Contratante'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <Button 
          variant="ghost" 
          onClick={onLogout}
          className={cn(
            "justify-start items-center text-slate-500 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all w-full px-2 py-2 rounded-xl"
          )}
        >
          <div className="flex items-center flex-1 min-w-0">
            <div className="w-10 h-10 flex items-center justify-center mr-3 shrink-0">
              <LogOut className="w-4 h-4 text-pink-500" />
            </div>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center justify-between flex-1 min-w-0"
                >
                  <span className="truncate flex items-center justify-between flex-grow">Sair</span>
                  <span className="text-[9px] text-slate-400 font-black opacity-70 uppercase tracking-widest ml-2 shrink-0">v2.9.5</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Button>
      </div>
    </motion.aside>
  );
}
