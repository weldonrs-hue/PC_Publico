'use client';

import { useState, useEffect, useRef } from 'react';
import { db, auth } from '@/lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  getDocs,
  addDoc, 
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { Send, User, MessageCircle, Loader2, Users, ChevronLeft, X, Search, Phone, Video, Info, MoreHorizontal, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType, isQuotaExceeded, setQuotaExceededGlobal } from '@/utils/firestore';

const CHAT_PRIMARY = '#0058be';
const CHAT_SECONDARY_CONTAINER = '#dee0e2';
const CHAT_SURFACE = '#f8f9ff';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  timestamp: any;
  channel: string;
}

interface ChatUser {
  id: string;
  nome: string;
  photoURL?: string;
  role?: string;
  isOnline?: boolean;
  lastActive?: Date | null;
}

interface ChatViewProps {
  user: any;
  personalData: any;
  onClose?: () => void;
}

export default function ChatView({ user, personalData, onClose }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, Message>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastReadTimestamps, setLastReadTimestamps] = useState<Record<string, number>>({});
  const lastReadTimestampsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    lastReadTimestampsRef.current = lastReadTimestamps;
  }, [lastReadTimestamps]);

  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isInactive, setIsInactive] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Heartbeat to track presence
  useEffect(() => {
    if (!auth.currentUser) return;
    
    const updatePresence = async () => {
      if (isQuotaExceeded()) return;
      try {
        const userRef = doc(db, 'users', auth.currentUser!.uid);
        // Only update if we haven't updated in the last 10 minutes locally
        const lastUpdate = localStorage.getItem(`chat_presence_last_${auth.currentUser!.uid}`);
        const now = Date.now();
        if (lastUpdate && (now - parseInt(lastUpdate)) < 600000) return; // 10 mins

        const updates: any = {
          lastActive: serverTimestamp(),
          isInactive: isInactive
        };

        // Silently sync profile info if available
        if (personalData?.nome) updates.nome = personalData.nome;
        if (personalData?.role) updates.role = personalData.role;
        if (personalData?.profilePhoto) updates.photoURL = personalData.profilePhoto;

        await updateDoc(userRef, updates);
        localStorage.setItem(`chat_presence_last_${auth.currentUser!.uid}`, now.toString());
      } catch (error: any) {
        console.warn('Error updating presence:', error);
        if (error.message?.includes('quota') || error.message?.includes('resource-exhausted')) {
          setQuotaExceededGlobal();
        }
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 15 * 60 * 1000); // Increased to 15 mins to save quota
    return () => clearInterval(interval);
  }, [auth.currentUser, isInactive]);

  // Load last read timestamps
  useEffect(() => {
    if (!auth.currentUser) return;
    const stored = localStorage.getItem(`chat_last_read_${auth.currentUser.uid}`);
    if (stored) {
      try {
        setLastReadTimestamps(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing lastReadTimestamps:', e);
      }
    }
  }, [auth.currentUser]);

  // Listen to messages for previews and unread counts - Optimized: Use getDocs instead of onSnapshot
  useEffect(() => {
    if (!auth.currentUser || isQuotaExceeded()) return;

    const fetchPreviews = async () => {
      try {
        const q = query(
          collection(db, 'chat_messages'),
          orderBy('timestamp', 'desc'),
          limit(200) // Reduced from 500 to save quota
        );
        
        const snapshot = await getDocs(q);
        const lastMsgs: Record<string, Message> = {};
        const unreads: Record<string, number> = {};
        const docs = [...snapshot.docs].reverse();
        
        docs.forEach(doc => {
          const msg = { id: doc.id, ...doc.data() } as Message;
          const channel = msg.channel;
          const isGeneral = channel === 'general';
          const isMyPrivateChannel = channel.startsWith('private_') && channel.includes(auth.currentUser!.uid);
          
          if (isGeneral || isMyPrivateChannel) {
            lastMsgs[channel] = msg;
            const lastRead = lastReadTimestampsRef.current[channel] || 0;
            const msgTime = msg.timestamp?.toDate ? msg.timestamp.toDate().getTime() : (msg.timestamp ? new Date(msg.timestamp).getTime() : 0);
            
            if (msg.senderId !== auth.currentUser!.uid && msgTime > lastRead && channel !== activeChannel) {
              unreads[channel] = (unreads[channel] || 0) + 1;
            }
          }
        });
        
        setLastMessages(lastMsgs);
        setUnreadCounts(unreads);
      } catch (error: any) {
        if (error.message?.includes('quota')) setQuotaExceededGlobal();
      }
    };

    fetchPreviews();
    // Refresh previews every 5 minutes instead of real-time snapshot
    const interval = setInterval(fetchPreviews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [auth.currentUser, activeChannel, lastReadTimestamps]);

  // Sync unread count to sidebar
  useEffect(() => {
    const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
    window.dispatchEvent(new CustomEvent('chat_unread_update', { detail: { count: totalUnread } }));
  }, [unreadCounts]);

  // Mark channel as read when opened
  useEffect(() => {
    if (activeChannel && auth.currentUser) {
      const now = Date.now();
      setLastReadTimestamps(prev => {
        const next = { ...prev, [activeChannel]: now };
        localStorage.setItem(`chat_last_read_${auth.currentUser!.uid}`, JSON.stringify(next));
        return next;
      });
      // Clear unread count for this channel immediately
      setUnreadCounts(prev => {
        if (!prev[activeChannel]) return prev;
        const next = { ...prev };
        delete next[activeChannel];
        return next;
      });
    }
  }, [activeChannel, auth.currentUser]);

  // Fetch users for list - Optimized: Use getDocs instead of onSnapshot
  useEffect(() => {
    if (!auth.currentUser?.uid || isQuotaExceeded()) return;
    
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'users'), limit(500));
        const snapshot = await getDocs(q);
        const users = snapshot.docs.map(doc => {
          const data = doc.data();
          const lastActive = data.lastActive?.toDate ? data.lastActive.toDate() : (data.lastActive ? new Date(data.lastActive) : null);
          const isOnline = lastActive && (new Date().getTime() - lastActive.getTime() < 10 * 60 * 1000);
          
          if (doc.id === auth.currentUser?.uid) {
            setCurrentUserData(data);
            setIsInactive(!!data.isInactive);
          }

          let userNome = data.nome || data.displayName || (data.usuario && data.usuario.length > 4 ? data.usuario : (data.email?.split('@')[0] || data.usuario || 'Usuário'));
          if ((!userNome || userNome === 'Usuário' || userNome === 'Sem nome') && data.email) {
            userNome = data.email.split('@')[0];
          }

          let roleLabel = 'Usuário';
          if (data.role === 'admin') roleLabel = 'Administrador';
          else if (data.role === 'viajante') roleLabel = 'Viajante';
          else if (data.role === 'pioneiro_especial') roleLabel = 'Pioneiro Especial';
          else if (data.role === 'pioneiro_regular') roleLabel = 'Pioneiro Regular';
          else if (data.role === 'anciao') roleLabel = 'Ancião';
          else if (data.role === 'servo') roleLabel = 'Servo Ministerial';
          else if (data.role === 'pioneiro') roleLabel = 'Pioneiro';
          else if (data.role === 'publicador') roleLabel = 'Publicador';
          else if (data.role) roleLabel = data.role.charAt(0).toUpperCase() + data.role.slice(1).replace('_', ' ');

          return {
            id: doc.id,
            nome: userNome,
            photoURL: data.photoURL,
            role: roleLabel,
            isOnline: isOnline && !data.isInactive,
            lastActive: lastActive,
            account: data.usuario || data.email
          };
        }) as ChatUser[];
        setChatUsers(users);
        setLoadingUsers(false);
      } catch (error: any) {
        console.warn('Error fetching users:', error);
        if (error.message?.includes('quota')) setQuotaExceededGlobal();
        setLoadingUsers(false);
      }
    };

    fetchUsers();
    
    // Add listener for manual refresh
    const handleManualRefresh = () => fetchUsers();
    window.addEventListener('refresh_chat_users', handleManualRefresh);

    // Refresh users list every 10 minutes instead of real-time
    const interval = setInterval(fetchUsers, 10 * 60 * 1000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('refresh_chat_users', handleManualRefresh);
    };
  }, [auth.currentUser?.uid]);

  const getPrivateChannelId = (uid1: string, uid2: string) => {
    const ids = [uid1, uid2].sort();
    return `private_${ids[0]}_${ids[1]}`;
  };

  useEffect(() => {
    if (!auth.currentUser || !activeChannel) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const q = query(
      collection(db, 'chat_messages'),
      where('channel', '==', activeChannel),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
      setLoading(false);
      setTimeout(scrollToBottom, 100);

      // Mark the channel as read in real-time when new messages arrive while channel is open
      if (auth.currentUser) {
        const now = Date.now();
        setLastReadTimestamps(prev => {
          const next = { ...prev, [activeChannel]: now };
          localStorage.setItem(`chat_last_read_${auth.currentUser!.uid}`, JSON.stringify(next));
          return next;
        });
        setUnreadCounts(prev => {
          if (!prev[activeChannel]) return prev;
          const next = { ...prev };
          delete next[activeChannel];
          return next;
        });
      }
    }, (error) => {
      console.error('Error listening to messages:', error);
      handleFirestoreError(error, OperationType.LIST, 'chat_messages');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeChannel]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !auth.currentUser) return;
    
    if (isQuotaExceeded()) {
      alert('Limite diário atingido. Tente novamente amanhã.');
      return;
    }

    setSending(true);
    const messageText = newMessage;
    setNewMessage('');

    try {
      const dbUser = chatUsers.find(u => u.id === auth.currentUser?.uid);
      const bestName = dbUser?.nome || personalData?.nome || user.displayName || user.nome || auth.currentUser.displayName || 'Usuário';
      const bestPhoto = dbUser?.photoURL || personalData?.profilePhoto || user.photoURL || auth.currentUser.photoURL || null;
      
      await addDoc(collection(db, 'chat_messages'), {
        senderId: auth.currentUser.uid,
        senderName: bestName,
        senderPhoto: bestPhoto,
        text: messageText,
        timestamp: serverTimestamp(),
        channel: activeChannel,
        senderRole: dbUser?.role || 'Usuário'
      });
      scrollToBottom();
      inputRef.current?.focus();
    } catch (error: any) {
       console.error('Error sending message:', error);
       if (error.message?.includes('quota') || error.message?.includes('resource-exhausted')) {
         alert('Limite de cotas excedido. Não foi possível enviar a mensagem.');
         setQuotaExceededGlobal();
       } else {
         handleFirestoreError(error, OperationType.CREATE, 'chat_messages');
       }
       setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  const switchChannel = (targetUser: ChatUser | 'general' | null) => {
    if (targetUser === null) {
      setActiveChannel(null);
      setSelectedUser(null);
    } else if (targetUser === 'general') {
      setActiveChannel('general');
      setSelectedUser(null);
    } else {
      setActiveChannel(getPrivateChannelId(auth.currentUser!.uid, targetUser.id));
      setSelectedUser(targetUser);
    }
    setIsSidebarOpen(false);
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  const filteredUsers = chatUsers
    .filter(u => 
      u.id !== auth.currentUser?.uid && 
      (u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
       u.role?.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      const chanA = getPrivateChannelId(auth.currentUser!.uid, a.id);
      const chanB = getPrivateChannelId(auth.currentUser!.uid, b.id);
      
      const unreadA = unreadCounts[chanA] || 0;
      const unreadB = unreadCounts[chanB] || 0;
      
      // Sort by unread first
      if (unreadA !== unreadB) return unreadB - unreadA;
      
      // Then by last message time
      const timeA = lastMessages[chanA]?.timestamp?.toDate ? lastMessages[chanA].timestamp.toDate().getTime() : 0;
      const timeB = lastMessages[chanB]?.timestamp?.toDate ? lastMessages[chanB].timestamp.toDate().getTime() : 0;
      
      return timeB - timeA;
    });

  const isShowingChat = !!activeChannel;

  return (
    <div className="flex w-full h-full bg-white rounded-xl overflow-hidden border border-[#c2c6d6] shadow-2xl relative pointer-events-auto font-sans">
      {/* List Area (WhatsApp side) */}
      <div className={`flex-1 flex flex-col h-full bg-white min-w-0 transition-all duration-300 ${isShowingChat ? 'hidden' : 'flex'}`}>
        {/* Header List */}
        <header className="bg-[#0058be] flex items-center justify-between px-4 py-3 w-full shadow-md z-10 transition-all flex-shrink-0 gap-3 overflow-hidden">
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full border-2 border-white/30 bg-white/10 flex items-center justify-center overflow-hidden shadow-inner">
                {personalData?.profilePhoto || currentUserData?.photoURL ? (
                  <img 
                    src={personalData?.profilePhoto || currentUserData?.photoURL} 
                    alt="Me" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <div className="w-full h-full bg-[#dee0e2] flex items-center justify-center">
                    <User className="text-[#5c5f60]" size={20} />
                  </div>
                )}
              </div>
              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-[#0058be] rounded-full shadow-sm transition-colors ${isInactive ? 'bg-gray-400' : 'bg-[#4edea3]'}`}></span>
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="font-extrabold text-[13px] text-white leading-none tracking-tight truncate">
                {currentUserData?.nome || personalData?.nome || user.displayName || 'Meu Chat'}
              </h1>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[9px] text-white/70 font-bold uppercase tracking-tight truncate">
                  {isInactive ? 'Offline' : (currentUserData?.role ? chatUsers.find(u => u.id === auth.currentUser?.uid)?.role : 'Online')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
            <button 
              onClick={() => setIsInactive(!isInactive)}
              className={`text-[9px] font-black px-2 py-1 rounded-lg transition-all border shadow-lg active:scale-95 flex-shrink-0 uppercase ${
                isInactive 
                  ? 'bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-600' 
                  : 'bg-red-500 text-white border-red-400 hover:bg-red-600'
              }`}
            >
              {isInactive ? 'Ativar' : 'Offline'}
            </button>
            {onClose && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="bg-white/10 text-white hover:bg-white/20 p-2 rounded-lg transition-all flex items-center justify-center border border-white/20 active:scale-95 flex-shrink-0"
              >
                <X size={16} strokeWidth={3} />
              </button>
            )}
          </div>
        </header>

        {/* Search Bar */}
        <div className="px-3 pt-3 pb-1 bg-[#f8f9ff] flex-shrink-0 mb-1">
          <div className="relative group w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#727785] group-focus-within:text-[#0058be] transition-colors" size={16} />
            <input 
              type="text"
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-[#c2c6d6] rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#0058be]/20 focus:border-[#0058be] transition-all placeholder:text-[#727785]/70 shadow-sm"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar bg-[#f8f9ff]">
          <div className="px-4 py-2 flex justify-between items-center bg-gray-50 border-b border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contatos</span>
            <button 
              onClick={() => {
                const event = new CustomEvent('refresh_chat_users');
                window.dispatchEvent(event);
              }}
              className="text-[10px] font-bold text-[#0058be] hover:underline flex items-center gap-1"
            >
              <RefreshCw size={10} />
              ATUALIZAR
            </button>
          </div>
          {/* General Channel */}
          <div 
            onClick={() => switchChannel('general')}
            className={`px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[#dee9fc] transition-colors border-b border-[#c2c6d6]/30 ${activeChannel === 'general' ? 'bg-[#dee9fc]' : ''}`}
          >
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-[#0058be] flex items-center justify-center text-white shadow-sm">
                <Users size={24} />
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#4edea3] border-2 border-white rounded-full"></span>
              {unreadCounts['general'] > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 border-2 border-white animate-bounce">
                  {unreadCounts['general']}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline">
                <h3 className="font-bold text-sm text-[#121c2a] truncate">Canal Geral</h3>
                <span className="text-[10px] text-[#0058be] font-bold">PÚBLICO</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <p className={`text-[12px] truncate flex-1 ${unreadCounts['general'] > 0 ? 'font-black text-[#121c2a]' : 'text-[#727785]'}`}>
                  {lastMessages['general'] ? lastMessages['general'].text : 'Fale com todos os membros'}
                </p>
                {lastMessages['general'] && (
                  <span className="text-[9px] text-gray-400 whitespace-nowrap">
                    {formatTime(lastMessages['general'].timestamp)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {loadingUsers ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-[#0058be]" size={24} />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <Search size={32} className="text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">Nenhum usuário encontrado</p>
            </div>
          ) : filteredUsers.map(chatUser => {
            const channelId = getPrivateChannelId(auth.currentUser!.uid, chatUser.id);
            const unreadCount = unreadCounts[channelId] || 0;
            const lastMsg = lastMessages[channelId];
            
            return (
              <div 
                key={chatUser.id}
                onClick={() => switchChannel(chatUser)}
                className={`px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[#dee9fc] transition-colors border-b border-[#c2c6d6]/30 ${activeChannel === channelId ? 'bg-[#dee9fc]' : ''}`}
              >
                <div className="relative flex-shrink-0">
                  {chatUser.photoURL ? (
                    <img 
                      src={chatUser.photoURL} 
                      alt={chatUser.nome} 
                      className="w-12 h-12 rounded-full object-cover border border-gray-100" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#dee0e2] flex items-center justify-center text-[#5c5f60]">
                      <User size={24} />
                    </div>
                  )}
                  {chatUser.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#4edea3] border-2 border-white rounded-full transition-all scale-110"></div>
                  )}
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 border-2 border-white scale-110">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2 mb-0.5">
                    <div className="flex flex-col min-w-0 flex-1">
                      <h1 className={`text-[13px] truncate leading-tight ${unreadCount > 0 ? 'font-black text-[#121c2a]' : 'font-bold text-[#121c2a]'}`}>{chatUser.nome}</h1>
                      <p className="text-[9px] text-[#727785] truncate font-mono opacity-60">{(chatUser as any).account}</p>
                    </div>
                    <span className="text-[8px] font-black text-[#0058be] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase shrink-0 tracking-tight">{chatUser.role}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <p className={`text-[11px] truncate flex-1 font-sans ${unreadCount > 0 ? 'font-black text-[#121c2a]' : 'text-[#727785]'}`}>
                      {lastMsg ? lastMsg.text : 'Clique para iniciar conversa'}
                    </p>
                    {lastMsg && (
                      <span className="text-[8px] text-gray-400 whitespace-nowrap bg-gray-50 px-1 rounded">
                        {formatTime(lastMsg.timestamp)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Tip Area */}
          <div className="mx-4 my-6 p-4 rounded-xl bg-[#e6eeff] border border-[#0058be]/10">
            <div className="flex items-center gap-2 mb-2">
              <Info className="text-[#0058be]" size={18} />
              <span className="text-[11px] font-bold text-[#0058be] uppercase tracking-wider">Dica do Suporte</span>
            </div>
            <p className="text-[12px] text-[#424754]">Você sabia que pode compartilhar fotos de perfil? Atualize seus dados pessoais!</p>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col min-w-0 bg-white ${!isShowingChat ? 'hidden' : 'flex'}`}>
        {/* Chat Header */}
        <header className="px-5 py-3 border-b border-[#c2c6d6] flex items-center justify-between bg-[#0058be] text-white shadow-md sticky top-0 z-10 transition-all flex-shrink-0">
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <button 
              onClick={() => switchChannel(null)}
              className="p-2 -ml-2 hover:bg-white/10 rounded-full text-white transition-colors flex-shrink-0"
              title="Voltar"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <div className="relative flex-shrink-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${selectedUser ? 'border-2 border-white/20' : 'bg-white/10'}`}>
                  {selectedUser ? (
                    selectedUser.photoURL ? (
                      <img 
                        src={selectedUser.photoURL} 
                        className="w-full h-full rounded-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-white font-bold">{selectedUser.nome.charAt(0)}</span>
                    )
                  ) : <Users size={20} />}
                </div>
                {(selectedUser?.isOnline || (!selectedUser && !isInactive)) && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#4edea3] border-2 border-[#0058be] rounded-full" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <h2 className="font-bold text-white text-[16px] leading-tight truncate">
                  {selectedUser ? selectedUser.nome : 'Canal Geral'}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${(!selectedUser && isInactive) || (selectedUser && !selectedUser.isOnline) ? 'bg-white/40' : 'bg-[#4edea3]'}`} />
                  <p className="text-[11px] text-white/80 font-medium truncate">
                    {selectedUser ? selectedUser.role : (isInactive ? 'Offline' : 'Online Agora')}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {onClose && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="bg-white/10 text-white hover:bg-white/20 p-2.5 rounded-2xl transition-all shadow-lg flex items-center justify-center border border-white/20 active:scale-95 flex-shrink-0"
                title="Fechar Chat"
              >
                <X size={20} strokeWidth={3} />
              </button>
            )}
          </div>
        </header>

        {/* Messages */}
        <div 
          className={`flex-1 overflow-y-auto px-4 py-6 space-y-4 transition-opacity duration-300 bg-[#f8f9ff]/50 ${isInactive ? 'opacity-20 pointer-events-none grayscale' : 'opacity-100'}`}
          style={{
            scrollbarWidth: 'thin'
          }}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-3">
              <Loader2 className="animate-spin text-[#0058be]" size={32} />
              <p className="text-xs font-bold text-[#727785] uppercase tracking-widest">Carregando...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center">
                <MessageCircle size={40} className="text-[#0058be]/20" />
              </div>
              <div className="text-center font-sans">
                <p className="font-bold text-[#121c2a]">Diga um "Oi!"</p>
                <p className="text-sm text-[#727785] mt-1">Comece uma conversa agora mesmo.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((msg, index) => {
                const isMe = msg.senderId === auth.currentUser?.uid;
                const prevMsg = index > 0 ? messages[index - 1] : null;
                const showDate = !prevMsg || formatDate(msg.timestamp) !== formatDate(prevMsg.timestamp);
                
                return (
                  <div key={msg.id} className="w-full">
                    {showDate && (
                      <div className="flex justify-center my-6">
                        <span className="text-[11px] font-bold text-[#727785] uppercase tracking-wider bg-white px-3 py-1 rounded-full border border-[#c2c6d6] shadow-sm font-sans">
                          {formatDate(msg.timestamp)}
                        </span>
                      </div>
                    )}
                    
                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-1 font-sans`}>
                      <div className={`flex items-end gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        {!isMe && (
                          <div className="w-8 flex-shrink-0">
                            {(() => {
                              const chatUser = chatUsers.find(u => u.id === msg.senderId);
                              const photo = chatUser?.photoURL || msg.senderPhoto;
                              return photo ? (
                                <img 
                                  src={photo} 
                                  alt="" 
                                  referrerPolicy="no-referrer"
                                  className="w-8 h-8 rounded-full object-cover shadow-sm border border-[#c2c6d6]" 
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-[#dee0e2] flex items-center justify-center text-[#5c5f60] border border-[#c2c6d6]">
                                  <User size={14} />
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        
                        <div className="flex flex-col">
                          {!isMe && !selectedUser && (
                            <div className="flex items-center gap-2 mb-1 ml-1">
                              <span className="text-[11px] font-bold text-[#121c2a]">
                                {chatUsers.find(u => u.id === msg.senderId)?.nome || msg.senderName}
                              </span>
                              <span className="text-[9px] font-black text-[#727785] bg-gray-100 px-1.5 py-0.5 rounded-md uppercase tracking-tighter">
                                {chatUsers.find(u => u.id === msg.senderId)?.role || (msg as any).senderRole || 'Usuário'}
                              </span>
                            </div>
                          )}
                          <div 
                            className={`
                              px-4 py-2.5 text-[14px] leading-relaxed shadow-sm
                              ${isMe 
                                ? 'bg-[#0058be] text-white rounded-2xl rounded-br-[4px]' 
                                : 'bg-[#dee0e2] text-[#121c2a] rounded-2xl rounded-bl-[4px]'}
                            `}
                          >
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                          </div>
                          <span className={`text-[10px] text-[#727785] mt-1 px-1 ${isMe ? 'text-right' : 'text-left'}`}>
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <footer className={`p-4 bg-white border-t border-[#c2c6d6] ${isInactive ? 'hidden' : 'block'}`}>
          <div className="max-w-4xl mx-auto flex items-end gap-2">
            <div className="flex-1 flex items-end bg-white border border-[#c2c6d6] rounded-xl p-2 focus-within:border-[#0058be] transition-colors shadow-sm">
              <textarea
                ref={inputRef as any}
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e as any);
                  }
                }}
                placeholder="Digite sua mensagem..."
                rows={1}
                className="flex-1 bg-transparent border-none focus:ring-0 text-[14px] py-1.5 resize-none max-h-32 text-[#121c2a] font-sans"
              />
            </div>
            
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sending}
              className={`
                p-2.5 rounded-lg flex-shrink-0 flex items-center justify-center transition-all active:scale-95 shadow-sm group h-[48px] px-5
                ${newMessage.trim() && !sending 
                  ? 'bg-[#0058be] text-white hover:bg-[#2170e4]' 
                  : 'bg-[#dee0e2] text-[#5c5f60]'}
              `}
            >
                {sending ? <Loader2 size={24} className="animate-spin" /> : (
                  <>
                    <Send size={20} className="mr-2 group-hover:translate-x-0.5 transition-transform" />
                    <span className="font-bold">Enviar</span>
                  </>
                )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
