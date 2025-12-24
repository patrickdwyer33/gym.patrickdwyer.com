import { WebSocketServer } from 'ws';

let wss = null;

/**
 * Initialize WebSocket server
 */
export function initWebSocketServer(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    console.log('WebSocket client connected');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        handleClientMessage(ws, data);
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'error', error: error.message }));
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', message: 'Connected to sync server' }));
  });

  console.log('WebSocket server initialized on /ws');
  return wss;
}

/**
 * Handle messages from client
 */
function handleClientMessage(ws, data) {
  switch (data.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;

    case 'subscribe':
      // Client wants to subscribe to changes
      ws.send(JSON.stringify({ type: 'subscribed' }));
      break;

    default:
      console.log('Unknown message type:', data.type);
  }
}

/**
 * Broadcast database changes to all connected clients
 */
export function broadcastChange(changeType, data) {
  if (!wss) return;

  const message = JSON.stringify({
    type: 'db_change',
    changeType,
    data,
    timestamp: new Date().toISOString(),
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });

  console.log(`Broadcasted ${changeType} to ${wss.clients.size} clients`);
}
