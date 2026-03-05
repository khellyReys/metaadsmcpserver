import { toolPaths } from '../public/tools/paths.js';

/**
 * Discovers and loads available tools from the tools directory
 * @returns {Promise<Array>} Array of tool objects with valid definitions
 */
export async function discoverTools() {
  const results = await Promise.all(
    toolPaths.map(async (file) => {
      try {
        const module = await import(`../public/tools/${file}`);
        const tool = module.apiTool || module.default;
        if (!tool?.definition?.function?.name) {
          console.warn(`[discoverTools] Skipping ${file}: missing definition.function.name`);
          return null;
        }
        return { ...tool, path: file };
      } catch (err) {
        console.warn(`[discoverTools] Failed to load ${file}:`, err?.message || err);
        return null;
      }
    })
  );
  return results.filter(Boolean);
}
