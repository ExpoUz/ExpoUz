import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import TelegramBot from 'node-telegram-bot-api';

/**
 * TelegramService
 *
 * Architecture: We use ONE Telegram supergroup (with forum/topics enabled) as
 * the central hub for the app.  Each match or pitch booking gets its own
 * Forum Topic inside that group.  Users join the group once (via invite link)
 * and all relevant topics become visible.
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN      – bot token from @BotFather
 *   TELEGRAM_FORUM_GROUP_ID – numeric id of the supergroup (negative, e.g. -1001234567890)
 *   APP_WEBHOOK_URL         – public HTTPS URL of the API (for Telegram webhook)
 *
 * Permissions the bot needs inside the group:
 *   - Manage Topics (create/close/delete forum topics)
 *   - Post Messages
 *   - Delete Messages
 */
@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: TelegramBot | null = null;
  private forumGroupId: number | null = null;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const groupId = process.env.TELEGRAM_FORUM_GROUP_ID;

    if (!token || !groupId) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN or TELEGRAM_FORUM_GROUP_ID not set — Telegram integration disabled',
      );
      return;
    }

    this.forumGroupId = parseInt(groupId, 10);

    // Use polling in dev, webhook in production
    const useWebhook = process.env.NODE_ENV === 'production' && !!process.env.APP_WEBHOOK_URL;

    this.bot = new TelegramBot(token, { polling: !useWebhook });

    if (useWebhook) {
      await this.bot.setWebHook(`${process.env.APP_WEBHOOK_URL}/telegram/webhook`);
      this.logger.log('Telegram webhook configured');
    } else {
      this.logger.log('Telegram polling mode active (development)');
    }

    this.registerHandlers();
  }

  get isEnabled(): boolean {
    return this.bot !== null && this.forumGroupId !== null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Create a forum topic for a match
  // Returns the topic id (message_thread_id)
  // ──────────────────────────────────────────────────────────────────────────
  async createMatchTopic(matchId: string, title: string): Promise<string | null> {
    if (!this.isEnabled) return null;

    try {
      const topic = await (this.bot as any).createForumTopic(this.forumGroupId!, {
        name: `⚽ ${title}`,
        icon_color: 0x00c853, // green
      });

      const topicId = String(topic.message_thread_id);

      // Send welcome message in the topic
      await this.bot!.sendMessage(
        this.forumGroupId!,
        `🏟️ *Match Chat: ${title}*\n\nThis is the group chat for your match. It will be deleted when the match ends.`,
        { message_thread_id: topic.message_thread_id, parse_mode: 'Markdown' },
      );

      // Persist topic id on the conversation linked to this match
      await this.prisma.conversation.updateMany({
        where: { matchId, type: 'MATCH_GROUP' },
        data: { telegramTopicId: topicId, telegramChatId: String(this.forumGroupId) },
      });

      this.logger.log(`Created Telegram topic ${topicId} for match ${matchId}`);
      return topicId;
    } catch (err) {
      this.logger.error(`Failed to create Telegram topic for match ${matchId}`, err);
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Create a forum topic for a pitch booking
  // ──────────────────────────────────────────────────────────────────────────
  async createPitchBookingTopic(pitchBookingId: string, title: string): Promise<string | null> {
    if (!this.isEnabled) return null;

    try {
      const topic = await (this.bot as any).createForumTopic(this.forumGroupId!, {
        name: `🏟️ ${title}`,
        icon_color: 0x1d9bf0, // blue
      });

      const topicId = String(topic.message_thread_id);

      await this.bot!.sendMessage(
        this.forumGroupId!,
        `📅 *Pitch Booking: ${title}*\n\nCoordinate with your group here. Chat is deleted after the session ends.`,
        { message_thread_id: topic.message_thread_id, parse_mode: 'Markdown' },
      );

      await this.prisma.conversation.updateMany({
        where: { pitchBookingId, type: 'PITCH_HIRE' },
        data: { telegramTopicId: topicId, telegramChatId: String(this.forumGroupId) },
      });

      this.logger.log(`Created Telegram topic ${topicId} for pitch booking ${pitchBookingId}`);
      return topicId;
    } catch (err) {
      this.logger.error(`Failed to create Telegram topic for booking ${pitchBookingId}`, err);
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Delete (close + archive) a topic when event is over
  // ──────────────────────────────────────────────────────────────────────────
  async closeTopic(telegramTopicId: string, reason = 'Event ended'): Promise<void> {
    if (!this.isEnabled || !telegramTopicId) return;

    try {
      const threadId = parseInt(telegramTopicId, 10);
      await this.bot!.sendMessage(
        this.forumGroupId!,
        `✅ *${reason}* — this chat has been closed.`,
        { message_thread_id: threadId, parse_mode: 'Markdown' },
      );
      // Close the forum topic (marks it as done)
      await (this.bot as any).closeForumTopic(this.forumGroupId!, threadId);
    } catch (err) {
      this.logger.error(`Failed to close Telegram topic ${telegramTopicId}`, err);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Send a message from the app into the Telegram topic
  // ──────────────────────────────────────────────────────────────────────────
  async sendToTopic(
    telegramTopicId: string,
    senderName: string,
    text: string,
  ): Promise<void> {
    if (!this.isEnabled || !telegramTopicId) return;

    try {
      await this.bot!.sendMessage(
        this.forumGroupId!,
        `*${senderName}*: ${text}`,
        {
          message_thread_id: parseInt(telegramTopicId, 10),
          parse_mode: 'Markdown',
        },
      );
    } catch (err) {
      this.logger.error('Failed to send message to Telegram topic', err);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Generate group invite link for users to join the forum group
  // ──────────────────────────────────────────────────────────────────────────
  async getGroupInviteLink(): Promise<string | null> {
    if (!this.isEnabled) return null;
    try {
      const link = await this.bot!.exportChatInviteLink(this.forumGroupId!);
      return link;
    } catch {
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Register webhook message handler — called when users send messages in
  // Telegram. Syncs back into the app's message store.
  // ──────────────────────────────────────────────────────────────────────────
  private registerHandlers() {
    if (!this.bot) return;

    // Private-chat deep links: t.me/<bot>?start=join_<shareCode> arrives here as
    // a "/start join_<code>" message in a 1:1 chat with the bot.
    this.bot.on('message', async (msg) => {
      if (msg.chat?.type !== 'private') return;
      const text = msg.text || '';
      if (!text.startsWith('/start')) return;

      const chatId = msg.chat.id;
      const miniAppUrl =
        process.env.PLAYER_TMA_URL ||
        process.env.TELEGRAM_MINI_APP_URL ||
        '';
      const arg = text.replace('/start', '').trim();

      try {
        if (arg.startsWith('join_')) {
          const shareCode = arg.replace('join_', '').trim();
          await this.bot!.sendMessage(
            chatId,
            `🔗 <b>You were invited to join a game!</b>\n\nTap below to view the match and join:`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '⚽ View & Join Match',
                      web_app: { url: `${miniAppUrl}/join/${shareCode}` },
                    },
                  ],
                ],
              },
            },
          );
        } else {
          await this.bot!.sendMessage(
            chatId,
            `👋 <b>Welcome to ExpoUz!</b>\n\nFind and join football games in Tashkent. Tap below to open the app.`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '⚽ Open ExpoUz', web_app: { url: miniAppUrl } }],
                ],
              },
            },
          );
        }
      } catch (err) {
        this.logger.error('Failed to handle /start deep link', err);
      }
    });

    this.bot.on('message', async (msg) => {
      // Only handle messages from the configured forum group
      if (msg.chat.id !== this.forumGroupId) return;
      // Only handle thread (topic) messages
      if (!msg.message_thread_id) return;
      // Skip bot's own messages
      if (msg.from?.is_bot) return;

      const threadId = String(msg.message_thread_id);
      const text = msg.text || msg.caption;
      if (!text) return;

      try {
        // Find conversation by telegram topic id
        const conversation = await this.prisma.conversation.findFirst({
          where: { telegramTopicId: threadId },
        });
        if (!conversation) return;

        // Find the user by their telegram id
        const fromTelegramId = String(msg.from?.id);
        const sender = await this.prisma.user.findFirst({
          where: { telegramId: fromTelegramId },
        });
        if (!sender) return;

        // Make sure they're a member of the conversation
        const membership = await this.prisma.conversationMember.findFirst({
          where: { conversationId: conversation.id, userId: sender.id },
        });
        if (!membership) {
          // Auto-add them since they're in the Telegram group
          await this.prisma.conversationMember.create({
            data: { conversationId: conversation.id, userId: sender.id },
          });
        }

        // Save message to DB
        await this.prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderId: sender.id,
            content: text,
            readBy: [sender.id],
          },
        });
      } catch (err) {
        this.logger.error('Failed to sync Telegram message to DB', err);
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Process webhook payload (used in production with HTTPS webhook)
  // ──────────────────────────────────────────────────────────────────────────
  processWebhook(body: any) {
    if (this.bot) {
      (this.bot as any).processUpdate(body);
    }
  }
}
