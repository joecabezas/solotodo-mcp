/**
 * Instancia única del servidor MCP, compartida por los dos transportes:
 * el Worker HTTP (`src/index.ts`) y el proceso stdio (`src/stdio.ts`).
 */
import { McpServer } from './server.js';
import type { ToolContext } from './types.js';
import { SolotodoClient } from '../solotodo/client.js';
import { TOOLS } from '../tools/index.js';

export const SERVER_NAME = 'solotodo-mcp';
export const SERVER_VERSION = '0.1.0';

const INSTRUCTIONS = [
  'Servidor MCP sobre los datos públicos de SoloTodo.cl (comparador de precios chileno).',
  '',
  'Flujo recomendado:',
  '1. `listar_categorias` si no conoces el nombre exacto de la categoría.',
  '2. `filtros_categoria` para descubrir qué specs se pueden filtrar y con qué valores.',
  '3. `buscar_productos` con categoría + precio en CLP + specs para obtener candidatos.',
  '4. `historial_precio` antes de recomendar una compra: distingue una oferta real de una inflada.',
  '5. `detalle_producto`, `comparar_productos` y `comentarios_producto` para cerrar la decisión.',
  '',
  'Los precios están en pesos chilenos y corresponden a tiendas que operan en Chile.',
].join('\n');

export const server = new McpServer(
  { name: SERVER_NAME, version: SERVER_VERSION, instructions: INSTRUCTIONS },
  TOOLS,
);

/** Variables de configuración del cliente; mismas claves en `wrangler.jsonc` y en `process.env`. */
export interface ClientEnv {
  SOLOTODO_API_BASE?: string;
  SOLOTODO_CACHE_TTL?: string;
  SOLOTODO_TIMEOUT_MS?: string;
}

/** Contexto nuevo por request: el memo del cliente no debe sobrevivir entre llamadas. */
export function createContext(env: ClientEnv): ToolContext {
  const client = new SolotodoClient({
    baseUrl: env.SOLOTODO_API_BASE,
    cacheTtl: intFromEnv(env.SOLOTODO_CACHE_TTL, 900),
    timeoutMs: intFromEnv(env.SOLOTODO_TIMEOUT_MS, 20_000),
  });
  return { client };
}

function intFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
