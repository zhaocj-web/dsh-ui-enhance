import type { ComponentType } from 'react';
import type { ProjectServices } from './services/projects';
type SlotDefinition = { name: string; id: string; order: number; label?: () => string };
export type ClientContext = ProjectServices & {
  effect(callback: () => () => void): unknown;
  slots: {
    inject(name: string, register: () => unknown): unknown;
    register(definition: SlotDefinition, component: ComponentType): unknown;
  };
};
