import React, { createContext, useContext, useState } from 'react';

interface DebugContextType {
  debugEnabled: boolean;
  toggleDebug: () => void;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export const DebugProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [debugEnabled, setDebugEnabled] = useState(false);

  const toggleDebug = () => {
    setDebugEnabled(prev => !prev);
    console.log('Debug mode:', !debugEnabled ? 'enabled' : 'disabled');
  };

  return (
    <DebugContext.Provider value={{ debugEnabled, toggleDebug }}>
      {children}
    </DebugContext.Provider>
  );
};

export const useDebug = () => {
  const context = useContext(DebugContext);
  if (context === undefined) {
    throw new Error('useDebug must be used within a DebugProvider');
  }
  return context;
};