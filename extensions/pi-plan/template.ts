/**
 * Minimal template engine for plan markdown rendering.
 *
 * Supports:
 * - `{{variable}}` — simple value interpolation
 * - `{{#each list}}...{{/each}}` — iteration over arrays
 * - `{{@index}}` — current index inside #each (0-based)
 * - `\\{{` — escaped literal `{{`
 *
 * No eval, no template injection. Designed for safety.
 */

/**
 * Render a template string with the given data.
 *
 * @param template - The template string containing `{{...}}` markers
 * @param data - An object mapping variable names to values
 * @returns The rendered string
 */
export function renderTemplate(template: string, data: Record<string, unknown>): string {
  let result = template;

  // Handle escaped braces first: \{{ → {{
  result = result.replace(/\\\{\{/g, "\u0000ESC_OPEN\u0000");
  result = result.replace(/\\\}\}/g, "\u0000ESC_CLOSE\u0000");

  // Process #each blocks recursively
  result = processEachBlocks(result, data);

  // Replace remaining simple variables
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
    const value = data[varName];
    if (value === undefined) return "";
    return String(value);
  });

  // Restore escaped braces
  result = result.replace(/\u0000ESC_OPEN\u0000/g, "{{");
  result = result.replace(/\u0000ESC_CLOSE\u0000/g, "}}");

  return result;
}

/**
 * Process {{#each list}}...{{/each}} blocks recursively.
 */
function processEachBlocks(template: string, data: Record<string, unknown>): string {
  const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

  return template.replace(eachRegex, (_match, listName: string, body: string) => {
    const list = data[listName];
    if (!Array.isArray(list)) return "";

    const parts: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const itemData: Record<string, unknown> = { ...data, ...(typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {}) };
      // Support @index inside each blocks
      itemData["@index"] = i;

      // Replace {{this}} with the current item (if scalar)
      let itemBody = body.replace(/\{\{this\}\}/g, String(item));

      // Recursively process nested #each blocks
      itemBody = processEachBlocks(itemBody, itemData);

      // Replace simple variables in the item body
      itemBody = itemBody.replace(/\{\{(\w+)\}\}/g, (_subMatch, varName: string) => {
        const value = itemData[varName];
        if (value === undefined) return "";
        return String(value);
      });

      parts.push(itemBody);
    }

    return parts.join("");
  });
}
