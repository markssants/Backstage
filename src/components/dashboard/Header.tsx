import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserProfile, EventProject, ViewType } from "../../types";
import { EventSelector } from "../events/EventSelector";
import { Layout, Users, ChevronDown, User, Sparkles, Shield, LogOut } from "lucide-react";
import { PendingChangesManager } from "./PendingChangesManager";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";

interface HeaderProps {
  profile: UserProfile;
  events: EventProject[];
  selectedEventId: string | null;
  setSelectedEventId: (id: string) => void;
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
}

export function Header({ profile, events, selectedEventId, setSelectedEventId, activeView, setActiveView }: HeaderProps) {
  const activeEvent = events.find(e => e.id === selectedEventId);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    signOut(auth);
  };

  const menuSelectItem = (view: ViewType) => {
    setActiveView(view);
    setIsOpen(false);
  };

  return (
    <header className="h-24 glass-header px-4 sm:px-6 md:px-8 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center space-x-3 sm:space-x-6">
        <div className="flex items-center space-x-3 sm:space-x-4">
          {events.length > 0 && selectedEventId ? (
            <div className="flex items-center space-x-1.5 sm:space-x-3">
              <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/10 shadow-lg shrink-0">
                <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                  <SelectTrigger className="w-10 h-10 sm:w-auto sm:h-10 border-none bg-transparent font-black text-white rounded-xl focus:ring-0 transition-all flex items-center justify-center p-0 sm:px-3 gap-2 [&_svg:last-child]:hidden sm:[&_svg:last-child]:block">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 to-purple-500 flex items-center justify-center shadow-[0_0_15px_rgba(236,72,153,0.3)] shrink-0">
                      <Layout className="text-white w-4.5 h-4.5 sm:w-5 sm:h-5" />
                    </div>
                    <span className="hidden sm:inline-block text-sm tracking-tight truncate max-w-[150px] md:max-w-[200px]">
                      <SelectValue placeholder="Selecione um evento">
                        {activeEvent?.name}
                      </SelectValue>
                    </span>
                  </SelectTrigger>
                  <SelectContent className="rounded-[1.5rem] bg-slate-900/95 border-white/10 backdrop-blur-xl text-slate-100 shadow-2xl">
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id} className="cursor-pointer focus:bg-pink-500 font-bold py-3 rounded-xl mx-1 my-1">
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {activeEvent && (
                <PendingChangesManager profile={profile} selectedEventId={selectedEventId} />
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2 sm:space-x-4">
               <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                 <Users className="text-pink-500 w-4 h-4 sm:w-5 sm:h-5" />
               </div>
               <h1 className="text-base sm:text-l font-black text-white tracking-tighter uppercase italic opacity-80 truncate max-w-[140px] min-[370px]:max-w-[200px] sm:max-w-none">
                 Olá, {profile.name.split(" ")[0]}
               </h1>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3">
        {activeEvent && activeView === 'overview' && (
          <EventSelector 
            profile={profile} 
            editEvent={activeEvent} 
            onEventUpdated={() => {}} 
            isMinimal 
          />
        )}
        {activeView === 'overview' && (
          <EventSelector profile={profile} onEventCreated={(id) => setSelectedEventId(id)} isMinimal />
        )}

        {/* User Account Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 p-1.5 pr-2 sm:p-2 sm:pr-3 rounded-2xl border border-white/10 active:scale-95 transition-all cursor-pointer"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-xs shadow-md">
              {profile.name[0].toUpperCase()}
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-white' : ''}`} />
          </button>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2.5 w-64 rounded-2xl bg-[#0e0821]/95 border border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl py-2 z-50 text-slate-100"
              >
                {/* Header of dropdown */}
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-xs text-slate-400 font-extrabold uppercase tracking-widest">Usuário</p>
                  <p className="text-sm font-bold text-white truncate mt-0.5">{profile.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">{profile.email}</p>
                </div>

                <div className="p-1.5 space-y-1">
                  <button 
                    onClick={() => menuSelectItem('profile')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs sm:text-sm font-bold transition-all ${
                      activeView === 'profile' ? 'bg-pink-500 text-white' : 'hover:bg-white/5 text-slate-300'
                    }`}
                  >
                    <User className="w-4 h-4 shrink-0" />
                    <span>Meu Perfil</span>
                  </button>

                  <button 
                    onClick={() => menuSelectItem('about')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs sm:text-sm font-bold transition-all ${
                      activeView === 'about' ? 'bg-pink-500 text-white' : 'hover:bg-white/5 text-slate-300'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>Sobre o App</span>
                  </button>

                  {profile.email === "beysarts@gmail.com" && (
                    <button 
                      onClick={() => menuSelectItem('admin')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs sm:text-sm font-bold transition-all ${
                        activeView === 'admin' ? 'bg-pink-500 text-white' : 'hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <Shield className="w-4 h-4 shrink-0" />
                      <span>Painel Geral Admin</span>
                    </button>
                  )}
                </div>

                <div className="border-t border-white/5 my-1" />

                <div className="p-1.5">
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs sm:text-sm font-bold text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>Sair da Conta</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
