import { FastifyInstance } from 'fastify';

interface WsSocket {
  tableId?: string;
  send: (data: string) => void;
}

function getWsServer(app: FastifyInstance): { broadcast: (tableId: string, event: Record<string, unknown>) => void } {
  return {
    broadcast: (tableId: string, event: Record<string, unknown>) => {
      const ws = (app as any).websocketServer;
      if (!ws) return;

      const clients = ws.clients as Set<WsSocket> | undefined;
      if (!clients) return;

      const message = JSON.stringify({ tableId, ...event });

      for (const client of clients) {
        if (client.tableId === tableId) {
          try {
            client.send(message);
          } catch {
            // Socket may have disconnected
          }
        }
      }
    },
  };
}

export default getWsServer;
