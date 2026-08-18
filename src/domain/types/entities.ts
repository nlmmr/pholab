export type ComponentCategory =
  | 'granular'
  | 'optics'
  | 'supports'
  | 'measuring'
  | 'sensors'
  | 'lasers'
  | 'mechanics';

export interface BallSpec {
  id: string;
  name: string;
  diameterMm: number;
  massG: number;
  color: string;
}

export interface PhOLabComponent3DState {
  id: string;
  name: string;
  category: ComponentCategory;
  inKitBox: boolean;
  position: [number, number, number];
  rotation: [number, number, number];
  isAssembled?: boolean;
  parentComponentId?: string;
  customProps?: Record<string, any>;
}

export interface PhOLabComponentManifest {
  id: string;
  name: string;
  category: ComponentCategory;
  icon: string;
  description: string;
  inKitBox: boolean;
  defaultPosition?: [number, number, number];
  defaultRotation?: [number, number, number];
  properties?: Record<string, any>;
}
