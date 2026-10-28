import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("omnios", {
  login: (email: string, password: string) => ipcRenderer.invoke("login", { email, password }),
  getPendingTerms: () => ipcRenderer.invoke("terms:get"),
  acceptTerms: () => ipcRenderer.invoke("terms:accept"),
  declineTerms: () => ipcRenderer.invoke("terms:decline"),
  getIdlePrompt: () => ipcRenderer.invoke("idle:get"),
  submitIdleReason: (reason: string) => ipcRenderer.invoke("idle:submit", reason),
});
