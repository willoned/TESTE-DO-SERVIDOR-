import React, { createContext, useContext, useEffect, useReducer, useState } from 'react';
import { AppState, AppContextType, MachineData, MediaItem, Announcement, LayoutSettings, LineConfig, ConnectionSettings, FloatingWindowConfig, AuthState, CreatorPermissions, UserRole, User } from '../types';
import { nodeRedService } from '../services/nodeRedService'; 
import { getMediaFromDB, deleteMediaFromDB } from '../services/db'; // Importação do Banco de Dados Local corrigida
import { APP_CONFIG, LINE_CONFIGS as INITIAL_LINES } from '../constants';

// Initial Data for playlists
const DEFAULT_MEDIA: MediaItem[] = [
    { id: '1', type: 'IMAGE', url: 'https://images.unsplash.com/photo-1559526323-cb2f2fe2591b?auto=format&fit=crop&q=80&w=2070', duration: 15, name: 'Happy Hour - Sexta' },
    { id: '2', type: 'IMAGE', url: 'https://images.unsplash.com/photo-1600788886242-5c96aabe3757?auto=format&fit=crop&q=80&w=2070', duration: 15, name: 'Controle de Qualidade' }
];

const BANNER_MEDIA: MediaItem[] = [
    { id: 'b1', type: 'IMAGE', url: 'https://images.unsplash.com/photo-1571613316887-6f8d5cbf7ef7?auto=format&fit=crop&q=80&w=2000', duration: 20, name: 'Banner Institucional' }
];

const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';

const STORAGE_KEY = 'IV_PRO_CONFIG_V1';

// NOVO: Cria um ID único para esta aba do navegador assim que ela é aberta (Crachá anti-eco)
const SESSION_ID = Math.random().toString(36).substring(2, 10);

const initialState: AppState = {
  lineConfigs: INITIAL_LINES, 
  machines: {},
  connectionStatus: 'DISCONNECTED',
  globalError: null,
  lastHeartbeat: 0,
  playlists: {
      'floating': DEFAULT_MEDIA,
      'banner': BANNER_MEDIA
  },
  announcements: [
    { id: '1', message: '🍺 Degustação da nova IPA às 16h no laboratório.', type: 'INFO', isActive: true },
    { id: '2', message: '⚠️ Temperatura do Fermentador 02 acima do ideal.', type: 'WARNING', isActive: true }
  ],
  showSettings: false,
  layout: {
    header: {
        title: 'Cervejaria MasterView',
        subtitle: 'Sistema Supervisório',
        textColor: '#ffffff',
        backgroundColor: '#1a110d',
        showTopMedia: false,
        topMediaHeight: 200,
        topMediaBorderWidth: 1,
        alignment: 'LEFT'
    },
    logoWidget: {
        show: true,
        x: 20,
        y: 20,
        w: 120,
        h: 120,
        url: ''
    },
    floatingWindows: [
        { id: 'floating', name: 'Principal', x: 800, y: 350, w: 400, h: 300 }
    ],
    areWindowsLocked: false,
    widgetSize: 'NORMAL',
    showMediaPanel: true,
    showTicker: true,
    tickerHeight: 60,
    tickerFontSize: 18,
    mediaFit: 'COVER',
    tickerSpeed: 30,
    isPartyMode: false,
    partyMessage: 'FESTA DA CERVEJA! 🍻',
    partyEffect: 'BUBBLES'
  },
  connectionConfig: {
    protocol: isSecure ? 'wss' : 'ws',
    host: '10.28.160.46', // IP do Node-RED para abas anônimas conectarem de primeira
    port: '1881',         // Porta do Node-RED
    path: '/ws/brewery-data',
    autoConnect: true
  },
  auth: {
    isAuthenticated: false,
    currentUser: null,
    users: [
      {
        id: 'admin-master',
        username: 'admin',
        passwordHash: '12112020',
        role: 'ADMIN',
        permissions: {
          canEditLines: true, canEditHeader: true, canEditApi: true,
          canEditLayout: true, canEditMedia: true, canEditAlerts: true,
          canEditParty: true, canManageUsers: true
        }
      }
    ]
  }
};

const loadState = (defaultState: AppState): AppState => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return defaultState;

        const parsed = JSON.parse(stored);

        if (parsed.layout && parsed.layout.mediaWindow && !parsed.layout.floatingWindows) {
            parsed.layout.floatingWindows = [{
                id: 'floating',
                name: 'Principal',
                x: parsed.layout.mediaWindow.x,
                y: parsed.layout.mediaWindow.y,
                w: parsed.layout.mediaWindow.w,
                h: parsed.layout.mediaWindow.h
            }];
            delete parsed.layout.mediaWindow;
        }

        return {
            ...defaultState,
            ...parsed,
            machines: {},
            connectionStatus: 'DISCONNECTED',
            globalError: null,
            lastHeartbeat: 0,
            showSettings: false,
            layout: { ...defaultState.layout, ...parsed.layout }, 
            connectionConfig: { ...defaultState.connectionConfig, ...parsed.connectionConfig }
        };
    } catch (error) {
        console.error("Failed to load persistence state, using defaults:", error);
        return defaultState;
    }
};

const sanitizeStateForStorage = (state: AppState) => {
    return {
        lineConfigs: state.lineConfigs,
        playlists: state.playlists,
        announcements: state.announcements.slice(-50), 
        layout: state.layout,
        connectionConfig: state.connectionConfig,
        // SEGURANÇA: Salva a lista de usuários no disco, mas ZERA a sessão!
        auth: {
            isAuthenticated: false,
            currentUser: null,
            users: state.auth.users
        }
    };
};

type Action = 
  | { type: 'UPDATE_RAW_DATA'; payload: any } 
  | { type: 'SET_CONNECTION'; payload: AppState['connectionStatus'] }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ADD_MEDIA'; payload: { key: string; item: MediaItem } }
  | { type: 'REMOVE_MEDIA'; payload: { key: string; id: string } }
  | { type: 'UPDATE_MEDIA'; payload: { key: string; id: string; data: Partial<MediaItem> } }
  | { type: 'REORDER_MEDIA'; payload: { key: string; startIndex: number; endIndex: number } }
  | { type: 'ADD_ANNOUNCEMENT'; payload: Announcement }
  | { type: 'REMOVE_ANNOUNCEMENT'; payload: string }
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'UPDATE_LAYOUT'; payload: Partial<LayoutSettings> }
  | { type: 'UPDATE_CONNECTION_CONFIG'; payload: Partial<ConnectionSettings> }
  | { type: 'ADD_LINE'; payload: LineConfig }
  | { type: 'UPDATE_LINE'; payload: { id: string; config: Partial<LineConfig> } }
  | { type: 'REMOVE_LINE'; payload: string }
  | { type: 'REORDER_LINES'; payload: { startIndex: number; endIndex: number } }
  | { type: 'ADD_WINDOW'; payload: { name: string } }
  | { type: 'REMOVE_WINDOW'; payload: string }
  | { type: 'UPDATE_WINDOW'; payload: { id: string; config: Partial<FloatingWindowConfig> } }
  | { type: 'RESET_WINDOWS_DIMENSIONS' }
  | { type: 'LOGIN'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'ADD_USER'; payload: User }
  | { type: 'UPDATE_USER'; payload: { id: string; data: Partial<User> } }
  | { type: 'REMOVE_USER'; payload: string }
  | { type: 'SET_PLAYLISTS'; payload: Record<string, MediaItem[]> }
  | { type: 'SYNC_STATE'; payload: AppState };
  
const normalizeData = (rawData: any, config: LineConfig, currentMachineState?: MachineData): MachineData | null => {
    const mapping = config.dataMapping;
    if (!mapping) return null;

    const values = rawData.payload || rawData; 
    const temperature = Number(values[mapping.temperatureKey]) || 0;
    
    const prevTrend = currentMachineState?.trend || [];
    const newTrendPoint = {
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        value: temperature 
    };
    
    const updatedTrend = [...prevTrend, newTrendPoint].slice(-20);

    return {
        lineId: config.id,
        status: values[mapping.statusKey] || 'STOPPED',
        productionCount: Number(values[mapping.productionKey]) || 0,
        currentHourlyRate: Number(values[mapping.speedKey]) || 0,
        rejectCount: Number(values[mapping.rejectKey]) || 0,
        efficiency: Number(values[mapping.efficiencyKey]) || 0,
        temperature: temperature,
        lastUpdated: Date.now(),
        trend: updatedTrend
    };
};

function machineReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'UPDATE_RAW_DATA': {
      const incoming = Array.isArray(action.payload) ? action.payload : [action.payload];
      
      // --- INTERCETAR CONFIGURAÇÃO VINDA DO NODE-RED ---
      // Verificamos exatamente o tópico que o React está enviando:
      const configMsg = incoming.find(msg => msg.topic === 'system/config/save');
      
      if (configMsg && configMsg.payload) {
          // TRAVA ANTI-ECO: Se essa mensagem veio de nós mesmos, jogue no lixo!
          if (configMsg.senderId === SESSION_ID) {
              return state;
          }

          console.log("🔥 UAU! O Admin mudou a tela, atualizando...", configMsg.payload);
          return {
              ...state,
              ...configMsg.payload,
              machines: state.machines, // Mantém os dados ao vivo das máquinas intactos
              connectionStatus: state.connectionStatus, // Mantém o status da rede local
              globalError: null, // Limpa qualquer erro de conexão residual
              auth: {
                  ...configMsg.payload.auth,
                  isAuthenticated: state.auth.isAuthenticated, // Mantém o login da aba atual (Segurança)
                  currentUser: state.auth.currentUser // Mantém quem está logado localmente
              }
          };
      }
      // -------------------------------------------------------

      const newMachines = { ...state.machines };
      let updatedAny = false;

      incoming.forEach(msg => {
          const matchId = msg.id || msg.topic; 
          const config = state.lineConfigs.find(l => l.id === matchId || l.nodeRedTopic === matchId);

          if (config) {
              const normalized = normalizeData(msg, config, newMachines[config.id]);
              if (normalized) {
                  newMachines[config.id] = normalized;
                  updatedAny = true;
              }
          }
      });

      if (!updatedAny) return state;

      return { ...state, machines: newMachines, lastHeartbeat: Date.now(), globalError: null };
    }
    case 'SET_CONNECTION':
      // Ao reconectar, limpa também a tarja vermelha de erro da tela
      return { 
          ...state, 
          connectionStatus: action.payload,
          globalError: action.payload === 'CONNECTED' ? null : state.globalError
      };
    case 'SET_ERROR':
      return { ...state, globalError: action.payload };
    case 'SET_PLAYLISTS':
      return { ...state, playlists: action.payload };
    case 'ADD_MEDIA': {
      const { key, item } = action.payload;
      const currentList = state.playlists[key] || [];
      return { ...state, playlists: { ...state.playlists, [key]: [...currentList, item] } };
    }
    case 'REMOVE_MEDIA': {
      const { key, id } = action.payload;
      const currentList = state.playlists[key] || [];
      return { ...state, playlists: { ...state.playlists, [key]: currentList.filter(i => i.id !== id) } };
    }
    case 'UPDATE_MEDIA': {
      const { key, id, data } = action.payload;
      const currentList = state.playlists[key] || [];
      return { ...state, playlists: { ...state.playlists, [key]: currentList.map(item => item.id === id ? { ...item, ...data } : item) } };
    }
    case 'REORDER_MEDIA': {
      const { key, startIndex, endIndex } = action.payload;
      const currentList = state.playlists[key] || [];
      const result = Array.from(currentList);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return { ...state, playlists: { ...state.playlists, [key]: result } };
    }
    case 'ADD_ANNOUNCEMENT':
      return { ...state, announcements: [...state.announcements, action.payload] };
    case 'REMOVE_ANNOUNCEMENT':
      return { ...state, announcements: state.announcements.filter(i => i.id !== action.payload) };
    case 'TOGGLE_SETTINGS':
      return { ...state, showSettings: !state.showSettings };
    case 'UPDATE_LAYOUT':
      let newLayout = { ...state.layout, ...action.payload };
      if (action.payload.header) newLayout.header = { ...state.layout.header, ...action.payload.header };
      if (action.payload.logoWidget) newLayout.logoWidget = { ...state.layout.logoWidget, ...action.payload.logoWidget };
      return { ...state, layout: newLayout };
    case 'UPDATE_CONNECTION_CONFIG':
      return { ...state, connectionConfig: { ...state.connectionConfig, ...action.payload } };
    case 'ADD_LINE':
      return { ...state, lineConfigs: [...state.lineConfigs, action.payload] };
    case 'REMOVE_LINE':
      return { ...state, lineConfigs: state.lineConfigs.filter(l => l.id !== action.payload) };
    case 'UPDATE_LINE':
      return { ...state, lineConfigs: state.lineConfigs.map(l => l.id === action.payload.id ? { ...l, ...action.payload.config } : l) };
    case 'REORDER_LINES': {
      const result = Array.from(state.lineConfigs);
      const [removed] = result.splice(action.payload.startIndex, 1);
      result.splice(action.payload.endIndex, 0, removed);
      return { ...state, lineConfigs: result };
    }
    case 'ADD_WINDOW': {
        const newId = `window-${Date.now()}`;
        const newWindow: FloatingWindowConfig = {
            id: newId, name: action.payload.name,
            x: 100 + (state.layout.floatingWindows.length * 20), y: 100 + (state.layout.floatingWindows.length * 20),
            w: 400, h: 300
        };
        return { ...state, layout: { ...state.layout, floatingWindows: [...state.layout.floatingWindows, newWindow] }, playlists: { ...state.playlists, [newId]: [] } };
    }
    case 'REMOVE_WINDOW': {
        return { ...state, layout: { ...state.layout, floatingWindows: state.layout.floatingWindows.filter(w => w.id !== action.payload) } };
    }
    case 'UPDATE_WINDOW': {
        return { ...state, layout: { ...state.layout, floatingWindows: state.layout.floatingWindows.map(w => w.id === action.payload.id ? { ...w, ...action.payload.config } : w) } };
    }
    case 'RESET_WINDOWS_DIMENSIONS': {
        return { ...state, layout: { ...state.layout, floatingWindows: state.layout.floatingWindows.map(w => ({ ...w, w: 200, h: 200 })) } };
    }
    case 'LOGIN':
      return { ...state, auth: { ...state.auth, isAuthenticated: true, currentUser: action.payload } };
    case 'LOGOUT':
      return { ...state, auth: { ...state.auth, isAuthenticated: false, currentUser: null } };
    case 'ADD_USER':
      return { ...state, auth: { ...state.auth, users: [...state.auth.users, action.payload] } };
    case 'UPDATE_USER':
      return { ...state, auth: { ...state.auth, users: state.auth.users.map(u => u.id === action.payload.id ? { ...u, ...action.payload.data } : u) } };
    case 'REMOVE_USER':
      return { ...state, auth: { ...state.auth, users: state.auth.users.filter(u => u.id !== action.payload) } };
    case 'SYNC_STATE':
      return { 
        ...state, 
        ...action.payload, 
        machines: state.machines, 
        connectionStatus: state.connectionStatus,
        globalError: null,
        // SEGURANÇA: Ao sincronizar as abas, mantém o status de login DA ABA ATUAL intacto!
        auth: {
            ...action.payload.auth, // Puxa novos usuários (se o admin criar um noutra aba)
            isAuthenticated: state.auth.isAuthenticated, // Mantém o login local (false ou true)
            currentUser: state.auth.currentUser // Mantém quem está logado aqui
        }
      };
    default:
      return state;
  }
}

const MachineContext = createContext<AppContextType | undefined>(undefined);

export const MachineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(machineReducer, initialState, loadState);
  const [isStale, setIsStale] = useState(false);

  // 1. AUTO-SAVE & PERSISTENCE EFFECT (Com Sincronização Node-RED)
  useEffect(() => {
    // TRAVA ANTI-LOOP INFINITO: 
    // O sistema SÓ envia para a rede se quem mexeu na tela estiver logado e com permissão!
    const canBroadcast = state.auth.isAuthenticated && (
        state.auth.currentUser?.role === 'ADMIN' || 
        state.auth.currentUser?.permissions?.canEditLayout === true
    );

    if (!canBroadcast) return; // Se não tiver logado, corta o fluxo aqui e não envia nada!

    const timeoutId = setTimeout(() => {
        const dataToSave = sanitizeStateForStorage(state);
        
        // 1. Guarda localmente no PC como redundância
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
        
        // 2. Envia a configuração inteira para o Node-RED partilhar com a fábrica!
        nodeRedService.sendMessage({ 
            topic: 'system/config/save', 
            senderId: SESSION_ID, // <-- AGORA A MENSAGEM VAI CARIMBADA!
            payload: dataToSave 
        });
    }, 1000); // Debounce de 1s para evitar travamentos

    return () => clearTimeout(timeoutId); 
  }, [
    state.lineConfigs, state.playlists, state.announcements, state.layout, state.connectionConfig, state.auth
  ]);

  // 1.5 HYDRATE MEDIA FROM INDEXEDDB ON LOAD
  useEffect(() => {
    const hydratePlaylists = async () => {
        const newPlaylists = { ...state.playlists };
        let hasChanges = false;

        for (const key of Object.keys(newPlaylists)) {
            const items = [...newPlaylists[key]];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.url.startsWith('blob:')) {
                    try {
                        const fileData = await getMediaFromDB(item.id);
                        if (fileData) {
                            items[i] = { ...item, url: URL.createObjectURL(fileData as Blob) };
                            hasChanges = true;
                        }
                    } catch (e) {
                        console.error(`Erro ao recarregar arquivo ${item.id}`, e);
                    }
                }
            }
            newPlaylists[key] = items;
        }

        if (hasChanges) {
            dispatch({ type: 'SET_PLAYLISTS', payload: newPlaylists });
        }
    };

    hydratePlaylists();
  }, []);

// 1.6 SINCRONIZAÇÃO ENTRE MÚLTIPLAS ABAS (CROSS-TAB SYNC)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
        // Se a alteração no disco (localStorage) foi feita por outra aba no nosso STORAGE_KEY
        if (e.key === STORAGE_KEY && e.newValue) {
            try {
                const newState = JSON.parse(e.newValue);
                dispatch({ type: 'SYNC_STATE', payload: newState });
            } catch (err) {
                console.error("Erro ao sincronizar dados de outra aba:", err);
            }
        }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    let wsUrl = APP_CONFIG.WS_URL;
    if (state.connectionConfig.host) {
        wsUrl = `${state.connectionConfig.protocol}://${state.connectionConfig.host}:${state.connectionConfig.port}${state.connectionConfig.path}`;
    }

    const cleanup = nodeRedService.connect(
      (data) => dispatch({ type: 'UPDATE_RAW_DATA', payload: data }),
      (status) => dispatch({ type: 'SET_CONNECTION', payload: status as any }),
      (errorMsg) => dispatch({ type: 'SET_ERROR', payload: errorMsg })
    );
    
    nodeRedService.updateConnectionConfig(wsUrl);
    return cleanup;
  }, [state.connectionConfig]);

  useEffect(() => {
    const timer = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - state.lastHeartbeat;
      const stale = timeSinceLastHeartbeat > APP_CONFIG.WATCHDOG_TIMEOUT && state.lastHeartbeat > 0;
      setIsStale(prev => prev !== stale ? stale : prev);
    }, 1000);
    return () => clearInterval(timer);
  }, [state.lastHeartbeat]);

  const addMedia = (playlistKey: string, item: MediaItem) => dispatch({ type: 'ADD_MEDIA', payload: { key: playlistKey, item } });
  
  const removeMedia = (playlistKey: string, id: string) => {
    deleteMediaFromDB(id).catch(console.error); // Exclui permanentemente do HD
    dispatch({ type: 'REMOVE_MEDIA', payload: { key: playlistKey, id } });
  };

  const updateMedia = (playlistKey: string, id: string, data: Partial<MediaItem>) => dispatch({ type: 'UPDATE_MEDIA', payload: { key: playlistKey, id, data } });
  const reorderMedia = (playlistKey: string, startIndex: number, endIndex: number) => dispatch({ type: 'REORDER_MEDIA', payload: { key: playlistKey, startIndex, endIndex } });
  const addAnnouncement = (item: Announcement) => dispatch({ type: 'ADD_ANNOUNCEMENT', payload: item });
  const removeAnnouncement = (id: string) => dispatch({ type: 'REMOVE_ANNOUNCEMENT', payload: id });
  const toggleSettings = () => dispatch({ type: 'TOGGLE_SETTINGS' });
  const updateLayout = (settings: Partial<LayoutSettings>) => dispatch({ type: 'UPDATE_LAYOUT', payload: settings });
  const updateConnectionConfig = (settings: Partial<ConnectionSettings>) => dispatch({ type: 'UPDATE_CONNECTION_CONFIG', payload: settings });
  const addLine = (config: LineConfig) => dispatch({ type: 'ADD_LINE', payload: config });
  const updateLine = (id: string, config: Partial<LineConfig>) => dispatch({ type: 'UPDATE_LINE', payload: { id, config } });
  const removeLine = (id: string) => dispatch({ type: 'REMOVE_LINE', payload: id });
  const reorderLines = (startIndex: number, endIndex: number) => dispatch({ type: 'REORDER_LINES', payload: { startIndex, endIndex } });
  const addWindow = (name: string) => dispatch({ type: 'ADD_WINDOW', payload: { name } });
  const removeWindow = (id: string) => dispatch({ type: 'REMOVE_WINDOW', payload: id });
  const updateWindow = (id: string, config: Partial<FloatingWindowConfig>) => dispatch({ type: 'UPDATE_WINDOW', payload: { id, config } });
  const resetWindowDimensions = () => dispatch({ type: 'RESET_WINDOWS_DIMENSIONS' });
  const clearError = () => dispatch({ type: 'SET_ERROR', payload: null });
  
  const login = (username: string, passwordHash: string) => {
    const user = state.auth.users.find(u => u.username === username && u.passwordHash === passwordHash);
    if (user) {
      dispatch({ type: 'LOGIN', payload: user });
      return true;
    }
    return false;
  };

  const logout = () => {
    dispatch({ type: 'LOGOUT' });
    if (state.showSettings) dispatch({ type: 'TOGGLE_SETTINGS' });
  };

  const addUser = (user: User) => dispatch({ type: 'ADD_USER', payload: user });
  const updateUser = (id: string, data: Partial<User>) => dispatch({ type: 'UPDATE_USER', payload: { id, data } });
  const removeUser = (id: string) => dispatch({ type: 'REMOVE_USER', payload: id });

  const value: AppContextType = {
    ...state,
    isStale,
    addMedia,
    removeMedia,
    updateMedia,
    reorderMedia,
    addAnnouncement,
    removeAnnouncement,
    toggleSettings,
    updateLayout,
    updateConnectionConfig,
    addLine,
    updateLine,
    removeLine,
    reorderLines,
    updateLineConfig: (id, target) => console.log('Legacy update called', id, target),
    addWindow,
    removeWindow,
    updateWindow,
    resetWindowDimensions,
    clearError,
    login,
    logout,
    addUser,
    updateUser,
    removeUser
  };

  return (
    <MachineContext.Provider value={value}>
      {children}
    </MachineContext.Provider>
  );
};

export const useMachineContext = () => {
  const context = useContext(MachineContext);
  if (!context) {
    throw new Error('useMachineContext must be used within a MachineProvider');
  }
  return context;
};