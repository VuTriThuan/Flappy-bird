import { contextBridge, ipcRenderer } from 'electron';
import type { AppState } from '../shared/contracts';
import type { Snapshot } from '../shared/engine';
contextBridge.exposeInMainWorld('flappy',{
  state:()=>ipcRenderer.invoke('state'),
  command:(name:string,data?:unknown)=>ipcRenderer.invoke('command',name,data),
  onState:(fn:(s:AppState)=>void)=>{const listener=(_e:unknown,s:AppState)=>fn(s);ipcRenderer.on('state',listener);return()=>ipcRenderer.removeListener('state',listener);},
  onSnapshot:(fn:(s:Snapshot)=>void)=>{const listener=(_e:unknown,s:Snapshot)=>fn(s);ipcRenderer.on('snapshot',listener);return()=>ipcRenderer.removeListener('snapshot',listener);}
});
