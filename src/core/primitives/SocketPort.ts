import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { SocketMountConfig, SocketMountEntity } from './SocketMountEntity';

export interface SocketPortConfig extends SocketMountConfig {
  /** Número de pinos físicos de encaixe (ex: 4 pinos nos furos da cubeta) */
  pinCount?: number;
  /** Se o encaixe exige orientação angular específica */
  polarized?: boolean;
}

export interface PlugConfig {
  id: string;
  name: string;
  type: string;
  pinCount?: number;
  group?: THREE.Group;
  metadata?: Record<string, unknown>;
}

/**
 * Plug: Representa um componente macho de encaixe mecânico ou elétrico
 * (ex: suporte S1/S2 com 4 pinos, cubeta óptica com 4 pés, cabo banana/BNC).
 */
export class Plug {
  public readonly id: string;
  public readonly name: string;
  public readonly type: string;
  public readonly pinCount: number;
  public readonly group: THREE.Group;
  public readonly metadata: Record<string, unknown>;

  private currentSocket: SocketPort | SocketMountEntity | null = null;

  constructor(config: PlugConfig) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.pinCount = config.pinCount ?? 1;
    this.group = config.group ?? new THREE.Group();
    this.metadata = config.metadata ?? {};
  }

  public isPlugged(): boolean {
    return this.currentSocket !== null;
  }

  public getCurrentSocket(): SocketPort | SocketMountEntity | null {
    return this.currentSocket;
  }

  public getCurrentSocketId(): string | null {
    return this.currentSocket?.id ?? null;
  }

  public _setCurrentSocket(socket: SocketPort | SocketMountEntity | null): void {
    this.currentSocket = socket;
  }

  /**
   * Conecta o plug a um soquete compatível
   */
  public plugInto(socket: SocketPort | SocketMountEntity, silent = false): boolean {
    if (!socket.canAccept(this.type)) {
      return false;
    }

    this.currentSocket = socket;
    if (socket instanceof SocketPort) {
      return socket.mountPlug(this, silent);
    }

    socket.mount(this.id, silent);
    return true;
  }

  /**
   * Desconecta o plug do soquete atual
   */
  public unplug(silent = false): void {
    if (this.currentSocket) {
      const sock = this.currentSocket;
      this.currentSocket = null;
      if (sock.getOccupant() === this.id) {
        sock.unmount(silent);
      }
    }
  }

  public getWorldPosition(): THREE.Vector3 {
    const worldPos = new THREE.Vector3();
    this.group.getWorldPosition(worldPos);
    return worldPos;
  }
}

/**
 * SocketPort: Porta fêmea universal de encaixe e ancoragem mecânica/elétrica
 * alinhada com as diretrizes PhOLab (GUIDELINES.md 3.1.3).
 */
export class SocketPort extends SocketMountEntity {
  public readonly pinCount: number;
  public readonly polarized: boolean;
  private mountedPlug: Plug | null = null;

  constructor(config: SocketPortConfig) {
    super(config);
    this.pinCount = config.pinCount ?? 1;
    this.polarized = config.polarized ?? false;
  }

  /**
   * Verifica se o soquete aceita um determinado Plug
   */
  public acceptsPlug(plug: Plug): boolean {
    return this.canAccept(plug.type);
  }

  /**
   * Acopla um objeto Plug ao soquete
   */
  public mountPlug(plug: Plug, silent = false): boolean {
    if (!this.canAccept(plug.type)) {
      return false;
    }

    // Desconecta ocupante anterior se houver
    if (this.mountedPlug && this.mountedPlug !== plug) {
      this.mountedPlug.unplug(true);
    }

    this.mount(plug.id, silent);
    this.mountedPlug = plug;
    plug._setCurrentSocket(this);
    return true;
  }

  /**
   * Remove o Plug acoplado ao soquete
   */
  public unmountPlug(silent = false): Plug | null {
    const plug = this.mountedPlug;
    this.mountedPlug = null;
    this.unmount(silent);
    if (plug && plug.isPlugged()) {
      plug._setCurrentSocket(null);
    }
    return plug;
  }

  public getMountedPlug(): Plug | null {
    return this.mountedPlug;
  }

  public override unmount(silent = false): void {
    super.unmount(silent);
    this.mountedPlug = null;
  }
}
