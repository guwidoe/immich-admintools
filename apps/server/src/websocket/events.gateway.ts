import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export interface QueueUpdateEvent {
  queueName: string;
  jobCounts: {
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    waiting: number;
    paused: number;
  };
  stuckJobsCount: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private connectedClients = 0;

  afterInit(): void {
    console.log('[EventsGateway] WebSocket gateway initialized');
  }

  handleConnection(client: Socket): void {
    this.connectedClients++;
    console.log(`[EventsGateway] Client connected: ${client.id} (total: ${this.connectedClients})`);
  }

  handleDisconnect(client: Socket): void {
    this.connectedClients--;
    console.log(`[EventsGateway] Client disconnected: ${client.id} (total: ${this.connectedClients})`);
  }

  emitQueueUpdate(event: QueueUpdateEvent): void {
    this.server.emit('queue:update', event);
  }

  emitHealthUpdate(status: { redis: boolean; immich: boolean; status: string }): void {
    this.server.emit('health:update', status);
  }

  getConnectedClientsCount(): number {
    return this.connectedClients;
  }
}
