import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Real-time channel for 1:1 and group chat. Clients join a room per
 * conversation and receive `message:new` / `message:read` events. Auth is kept
 * light here (rooms are opaque cuids); REST endpoints remain the authoritative
 * guard for membership before anything is persisted.
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: 'messages' })
export class MessagesGateway {
  @WebSocketServer() server: Server;

  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.join(`conversation:${data.conversationId}`);
    client.emit('joined', { room: `conversation:${data.conversationId}` });
  }

  @SubscribeMessage('leave')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.leave(`conversation:${data.conversationId}`);
  }

  emitNewMessage(conversationId: string, payload: any) {
    this.server.to(`conversation:${conversationId}`).emit('message:new', payload);
  }

  emitRead(conversationId: string, payload: { userId: string }) {
    this.server.to(`conversation:${conversationId}`).emit('message:read', payload);
  }
}
