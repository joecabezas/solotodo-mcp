/**
 * Transporte stdio del servidor MCP, para clientes locales que lanzan el servidor
 * como proceso hijo (Claude Code, etc.). Evita tener que dejar `wrangler dev`
 * corriendo: el cliente arranca el proceso al iniciar la sesión y lo cierra al salir.
 *
 * Protocolo: un mensaje JSON-RPC por línea en stdin, una respuesta por línea en
 * stdout. stdout es exclusivo del protocolo; los diagnósticos van a stderr.
 *
 * Sin OAuth: el proceso solo es alcanzable por quien lo lanzó. Tampoco hay Cache
 * API fuera de Workers, así que cada llamada va directo a la API de SoloTodo.
 */
import { createInterface } from 'node:readline';
import { createContext, server } from './mcp/instance.js';
import { RPC_PARSE_ERROR, type JsonRpcResponse } from './mcp/types.js';

const pending = new Set<Promise<void>>();

function send(response: JsonRpcResponse | JsonRpcResponse[]): void {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

async function handleLine(line: string): Promise<void> {
  let payload: unknown;
  try {
    payload = JSON.parse(line);
  } catch {
    send({ jsonrpc: '2.0', id: null, error: { code: RPC_PARSE_ERROR, message: 'La línea no es JSON válido' } });
    return;
  }

  const ctx = createContext(process.env);

  if (Array.isArray(payload)) {
    const responses = (await Promise.all(payload.map((message) => server.handleMessage(message, ctx)))).filter(
      (response): response is JsonRpcResponse => response !== null,
    );
    if (responses.length > 0) send(responses);
    return;
  }

  const response = await server.handleMessage(payload, ctx);
  if (response !== null) send(response);
}

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });

lines.on('line', (line) => {
  if (line.trim() === '') return;
  // Sin await: las llamadas a herramientas se atienden en paralelo, como en HTTP.
  const task = handleLine(line)
    .catch((error: unknown) => console.error('Error no controlado:', error))
    .finally(() => pending.delete(task));
  pending.add(task);
});

// stdin cerrado = el cliente se fue. Se termina lo que esté en curso y se sale.
lines.on('close', () => {
  void Promise.all(pending).then(() => process.exit(0));
});
