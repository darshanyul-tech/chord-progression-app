import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultDynamicsArticulationSettings, type DASettings } from '../../lib/recognition/dynamicsArticulation';

export const useDynamicsArticulationSettings = createPersistedSettingsStore<DASettings>(
  'dynamics-articulation',
  defaultDynamicsArticulationSettings(),
);
