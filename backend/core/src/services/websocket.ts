import { Server } from "http";
import WebSocket from "ws";

type WebSocketServer = InstanceType<typeof WebSocket.Server>;
type WsClient = InstanceType<typeof WebSocket>;

export let webSocketServer: WebSocketServer;

export function initWebSocketServer(server: Server) {
    webSocketServer = new WebSocket.Server({ server });

    webSocketServer.on('connection', (ws: WsClient) => {
        console.log('Client connected to WebSocket');
        ws.on('close', () => {
            console.log('Client disconnected from WebSocket');
        });
        ws.on('error', (error: Error) => {
            console.error('WebSocket error:', error);
        });
    });
}

export function broadcastEvent(event: string, payload: any) {
    if (!webSocketServer) {
        console.warn('WebSocket server not initalised, cant broadcast event');
        return;
    }
    const msg = JSON.stringify({ event, payload });

    webSocketServer.clients.forEach((client: WsClient) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}
