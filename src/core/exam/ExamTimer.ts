export type ExamMode = 'practice' | 'competition';

export interface ExamTimerConfig {
  durationMinutes: number;
  mode?: ExamMode;
  onTick?: (elapsed: number, remaining: number) => void;
  onExpire?: () => void;
}

export class ExamTimer {
  public readonly mode: ExamMode;
  public readonly durationSeconds: number;
  private elapsedSeconds = 0;
  private isRunning = false;
  private intervalId: number | null = null;
  private onTick?: (elapsed: number, remaining: number) => void;
  private onExpire?: () => void;

  constructor(config: ExamTimerConfig) {
    this.durationSeconds = config.durationMinutes * 60;
    this.mode = config.mode ?? 'practice';
    this.onTick = config.onTick;
    this.onExpire = config.onExpire;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    if (typeof window !== 'undefined') {
      this.intervalId = window.setInterval(() => {
        this.tick();
      }, 1000);
    }
  }

  public pause(): boolean {
    if (this.mode === 'competition') {
      // No modo competição o cronômetro não pode ser pausado
      return false;
    }
    if (!this.isRunning) return false;
    this.isRunning = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    return true;
  }

  public toggle(): boolean {
    if (this.isRunning) return this.pause();
    this.start();
    return true;
  }

  public reset(): boolean {
    if (this.mode === 'competition') {
      // No modo competição o exame não pode ser resetado pelo aluno
      return false;
    }
    this.pause();
    this.elapsedSeconds = 0;
    return true;
  }

  private tick(): void {
    this.elapsedSeconds += 1;
    const remaining = Math.max(0, this.durationSeconds - this.elapsedSeconds);

    if (this.onTick) {
      this.onTick(this.elapsedSeconds, remaining);
    }

    if (remaining <= 0) {
      this.pause();
      if (this.onExpire) {
        this.onExpire();
      }
    }
  }

  public getElapsedSeconds(): number {
    return this.elapsedSeconds;
  }

  public getRemainingSeconds(): number {
    return Math.max(0, this.durationSeconds - this.elapsedSeconds);
  }

  public getFormattedElapsed(): string {
    return this.formatTime(this.elapsedSeconds);
  }

  public getFormattedRemaining(): string {
    return this.formatTime(this.getRemainingSeconds());
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [hours, minutes, secs].map((v) => String(v).padStart(2, '0')).join(':');
  }

  public dispose(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }
}
