import { useState, useEffect, useCallback, useMemo } from 'react';
import { LocalTableGameTemplate } from '@/shared/api';
import { loadAllTemplates } from '@/shared/utils/templateResolver';

// Fired whenever templates are created, edited or deleted so open pages refresh
export const TEMPLATE_EVENTS = ['templateCreated', 'templateUpdated', 'templatesChanged'];

/**
 * Notify listeners (useGameTemplates) that the template list changed.
 */
export const notifyTemplatesChanged = () => {
  globalThis.dispatchEvent(new CustomEvent('templatesChanged'));
};

/**
 * All startable game templates (system + local, one per name), kept fresh.
 * Pulls the user's cloud templates once on mount when logged in.
 * @returns {{ templates: Array, loading: boolean, reload: Function }}
 */
export function useGameTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setTemplates(await loadAllTemplates());
    } catch (error) {
      console.error('Error loading game templates:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // Merge cloud templates into local storage, then show them (no-op when logged out/offline)
    LocalTableGameTemplate.downloadFromCloud()
      .then(() => reload())
      .catch((error) => console.warn('Could not download templates:', error));

    const handleChange = () => { void reload(); };
    TEMPLATE_EVENTS.forEach((name) => globalThis.addEventListener(name, handleChange));
    return () => TEMPLATE_EVENTS.forEach((name) => globalThis.removeEventListener(name, handleChange));
  }, [reload]);

  return { templates, loading, reload };
}

/**
 * Look up loaded templates by name (case-insensitive), e.g. to show box art on game cards.
 * @returns {(name: string) => Object|null}
 */
export function useTemplateLookup() {
  const { templates } = useGameTemplates();
  return useMemo(() => {
    const byName = new Map(templates.map((tpl) => [(tpl.name || '').trim().toLowerCase(), tpl]));
    return (name) => byName.get((name || '').trim().toLowerCase()) || null;
  }, [templates]);
}
