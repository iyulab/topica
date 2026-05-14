import { create } from "zustand";

interface AppStore {
  isConnected: boolean;
  setConnected: (v: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  isConnected: false,
  setConnected: (v) => set({ isConnected: v }),
}));
