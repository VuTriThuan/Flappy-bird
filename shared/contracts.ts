import type { Config, Snapshot } from './engine';
export type RecordingStatus = 'recording' | 'ready' | 'interrupted' | 'error';
export type Recording = { schemaVersion: 1; engineVersion: '1'; renderVersion: '1'; assetVersion: 'canvas-1';
  id: string; startedAt: string; timezone: string; seed: number; config: Config; width: 1080; height: 1920;
  fps: 60; logicWidth: 360; logicHeight: 640; source: 'manual' | 'schedule'; scheduleId?: string;
  status: RecordingStatus; frameCount: number; durationSeconds: number; chunks: string[]; error?: string };
export type ScheduleStatus = 'pending' | 'running' | 'completed' | 'cancelled' | 'missed' | 'interrupted' | 'failed';
export type Schedule = { id: string; startAt: string; timezone: string; localInput: string; durationSeconds: number;
  status: ScheduleStatus; recordingId?: string; actualStartedAt?: string; actualDurationSeconds?: number; message?: string };
export type ExportStatus = { state: 'idle' | 'preparing' | 'rendering' | 'encoding' | 'verifying' | 'completed' | 'cancelled' | 'error';
  recordingId?: string; frame?: number; total?: number; path?: string; error?: string };
export type AppState = { game: 'idle' | 'running' | 'paused' | 'gameOver' | 'restarting'; score: number; best: number;
  recording?: Recording; recordings: Recording[]; schedules: Schedule[]; export: ExportStatus;
  lagMs: number; writerQueue: number; memoryMb: number; peakMemoryMb: number; doctorResult?: string; message?: string; timezone: string; seed: number; mode: Config['mode'] };
export type Bridge = {
  state(): Promise<AppState>; command(name: string, data?: unknown): Promise<AppState>;
  onState(fn: (s: AppState) => void): () => void; onSnapshot(fn: (s: Snapshot) => void): () => void;
};
