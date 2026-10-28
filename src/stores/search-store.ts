import { create } from "zustand";

interface SearchState {
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  activeDialog: string | null;
  setActiveDialog: (dialog: string | null) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),
  activeDialog: null,
  setActiveDialog: (dialog) => set({ activeDialog: dialog }),
}));
