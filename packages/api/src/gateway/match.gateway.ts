import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'matches' })
export class MatchGateway {
  @WebSocketServer() server: Server;

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ) {
    client.join(`match:${data.matchId}`);
    client.emit('joined', { room: `match:${data.matchId}` });
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ) {
    client.leave(`match:${data.matchId}`);
  }

  emitPlayerJoined(matchId: string, payload: any) {
    this.server.to(`match:${matchId}`).emit('match:player-joined', payload);
  }

  emitPlayerLeft(matchId: string, payload: any) {
    this.server.to(`match:${matchId}`).emit('match:player-left', payload);
  }

  emitPositionLocked(matchId: string, payload: any) {
    this.server.to(`match:${matchId}`).emit('match:position-locked', payload);
  }

  emitPositionUnlocked(matchId: string, payload: any) {
    this.server.to(`match:${matchId}`).emit('match:position-unlocked', payload);
  }

  emitStatusChanged(matchId: string, payload: any) {
    this.server.to(`match:${matchId}`).emit('match:status-changed', payload);
  }

  emitHotGame(matchId: string, payload: any) {
    this.server.to(`match:${matchId}`).emit('match:hot-game', payload);
  }
}
