import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { messagesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

function getConvLabel(conv: any) {
  switch (conv.type) {
    case 'MATCH_GROUP': return { icon: 'âš½', label: 'Match Group', color: '#22C55E' };
    case 'PITCH_HIRE': return { icon: 'ðŸŸ', label: 'Pitch Hire', color: '#3b82f6' };
    case 'DIRECT': return null;
    default: return { icon: 'ðŸ’¬', label: conv.type, color: '#888' };
  }
}

function getConvTitle(conv: any, currentUserId: string) {
  const badge = getConvLabel(conv);
  if (badge) {
    return conv.name ?? `${badge.icon} ${badge.label}`;
  }
  // DIRECT
  const other = conv.members?.find((m: any) => m.userId !== currentUserId)?.user;
  return other ? `${other.firstName} ${other.lastName}` : 'Chat';
}

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const { data: convRes, isLoading: convLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagesApi.getConversations(),
    select: (r) => r.data,
    enabled: !!user,
    refetchInterval: 10_000,
  });

  const conversations = convRes ?? [];

  const activeConv = conversations.find((c: any) => c.id === activeConvId);

  const { data: msgsRes, isLoading: msgsLoading } = useQuery({
    queryKey: ['messages', activeConvId],
    queryFn: () => messagesApi.getMessages(activeConvId!),
    select: (r) => Array.isArray(r.data) ? r.data : (r.data?.data ?? []),
    enabled: !!activeConvId,
    refetchInterval: 3_000,
  });

  const messages: any[] = msgsRes ?? [];

  const sendMutation = useMutation({
    mutationFn: () => messagesApi.sendMessage(activeConvId!, message.trim()),
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['messages', activeConvId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.guestState}>
          <Text style={styles.emptyEmoji}>ðŸ’¬</Text>
          <Text style={styles.emptyTitle}>Sign in to chat</Text>
          <Text style={styles.emptySubtitle}>Connect with teammates and hosts</Text>
          <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/auth/phone')}>
            <Text style={styles.signInText}>Sign In â†’</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Full-screen conversation view
  if (activeConvId) {
    const badge = activeConv ? getConvLabel(activeConv) : null;
    const chatTitle = activeConv ? getConvTitle(activeConv, user.id) : 'Chat';
    const memberCount = activeConv?._count?.members ?? activeConv?.members?.length ?? null;

    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Chat Header â€” Telegram-style */}
        <View style={styles.chatHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setActiveConvId(null)}>
            <Text style={styles.backText}>â†</Text>
          </TouchableOpacity>
          <View style={styles.chatHeaderInfo}>
            <View style={styles.chatHeaderRow}>
              {badge && (
                <View style={[styles.convTypeBadge, { backgroundColor: badge.color + '22' }]}>
                  <Text style={[styles.convTypeBadgeText, { color: badge.color }]}>
                    {badge.icon} {badge.label}
                  </Text>
                </View>
              )}
              <Text style={styles.chatTitle} numberOfLines={1}>{chatTitle}</Text>
            </View>
            {memberCount && (
              <Text style={styles.chatSubtitle}>{memberCount} members</Text>
            )}
          </View>
        </View>

        {/* Messages */}
        {msgsLoading ? (
          <ActivityIndicator style={{ flex: 1 }} color="#22C55E" />
        ) : (
          <FlatList
            data={[...messages].reverse()}
            keyExtractor={(m: any) => m.id}
            inverted
            contentContainerStyle={styles.messagesList}
            renderItem={({ item: msg }: { item: any }) => {
              const isMe = msg.senderId === user.id;
              const senderName = msg.sender
                ? `${msg.sender.firstName} ${msg.sender.lastName}`
                : null;
              const isGroup = activeConv?.type === 'MATCH_GROUP' || activeConv?.type === 'PITCH_HIRE';
              return (
                <View style={[styles.msgBubbleWrap, isMe ? styles.msgMe : styles.msgThem]}>
                  {isGroup && !isMe && senderName && (
                    <Text style={styles.senderName}>{senderName}</Text>
                  )}
                  <View style={[styles.msgBubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                    <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextThem]}>
                      {msg.content ?? msg.body}
                    </Text>
                    <Text style={[styles.msgTimeInline, isMe ? styles.msgTimeMe : styles.msgTimeThem]}>
                      {dayjs(msg.createdAt).format('HH:mm')}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatText}>No messages yet. Say hello! ðŸ‘‹</Text>
              </View>
            }
          />
        )}

        {/* Input */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={message}
              onChangeText={setMessage}
              placeholder="Message..."
              placeholderTextColor="#6B7280"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!message.trim() || sendMutation.isPending) && styles.sendBtnDisabled]}
              onPress={() => sendMutation.mutate()}
              disabled={!message.trim() || sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sendBtnText}>â†‘</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Conversations list
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Messages</Text>
      </View>

      {convLoading ? (
        <SkeletonLoader variant="list" />
      ) : conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>ðŸ’¬</Text>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySubtitle}>Join a game to chat with your teammates</Text>
          <TouchableOpacity style={styles.findGameBtn} onPress={() => router.push('/(tabs)/games' as any)}>
            <Text style={styles.findGameText}>Find a Game â†’</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c: any) => c.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item: conv }: { item: any }) => {
            const badge = getConvLabel(conv);
            const title = getConvTitle(conv, user.id);
            const lastMsg = conv.lastMessage ?? conv.messages?.[conv.messages?.length - 1];
            const unread = (conv.unreadCount ?? 0) > 0;
            return (
              <TouchableOpacity style={styles.convRow} onPress={() => setActiveConvId(conv.id)}>
                {/* Avatar or group icon */}
                {badge ? (
                  <View style={[styles.groupIcon, { backgroundColor: badge.color + '22' }]}>
                    <Text style={styles.groupIconEmoji}>{badge.icon}</Text>
                  </View>
                ) : (
                  <PlayerAvatar
                    user={conv.members?.find((m: any) => m.userId !== user.id)?.user ?? { id: conv.id, avatarUrl: null, firstName: '?', lastName: '' }}
                    size={48}
                  />
                )}
                <View style={styles.convInfo}>
                  <View style={styles.convTopRow}>
                    <View style={styles.convTitleRow}>
                      {badge && (
                        <View style={[styles.smallBadge, { backgroundColor: badge.color + '22' }]}>
                          <Text style={[styles.smallBadgeText, { color: badge.color }]}>{badge.label}</Text>
                        </View>
                      )}
                      <Text style={[styles.convName, unread && styles.convNameBold]} numberOfLines={1}>
                        {title}
                      </Text>
                    </View>
                    {lastMsg && (
                      <Text style={styles.convTime}>{dayjs(lastMsg.createdAt).fromNow()}</Text>
                    )}
                  </View>
                  <View style={styles.convBottomRow}>
                    <Text style={[styles.convPreview, unread && styles.convPreviewBold]} numberOfLines={1}>
                      {lastMsg ? (lastMsg.content ?? lastMsg.body ?? '...') : 'Start a conversation'}
                    </Text>
                    {unread && (
                      <View style={styles.unreadDot}>
                        <Text style={styles.unreadCount}>{conv.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D0D' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1E1E1E' },
  listTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  guestState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  signInBtn: { backgroundColor: '#22C55E', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  signInText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  findGameBtn: { backgroundColor: '#1A3A2E', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  findGameText: { color: '#22C55E', fontWeight: '700', fontSize: 15 },
  groupIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  groupIconEmoji: { fontSize: 24 },
  convRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A1A', gap: 12 },
  convInfo: { flex: 1 },
  convTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  convTitleRow: { flex: 1, gap: 4 },
  convName: { fontSize: 15, color: '#FFFFFF', fontWeight: '500' },
  convNameBold: { fontWeight: '700' },
  convTime: { fontSize: 12, color: '#6B7280', marginLeft: 8 },
  convBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  convPreview: { flex: 1, fontSize: 13, color: '#6B7280', marginRight: 8 },
  convPreviewBold: { color: '#9CA3AF', fontWeight: '500' },
  smallBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  smallBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  unreadDot: { backgroundColor: '#22C55E', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  unreadCount: { color: '#fff', fontSize: 11, fontWeight: '700' },
  // Chat view
  chatHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#1E1E1E', backgroundColor: '#111827', gap: 10 },
  backBtn: { padding: 4 },
  backText: { color: '#22C55E', fontSize: 20 },
  chatHeaderInfo: { flex: 1 },
  chatHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  convTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  convTypeBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  chatTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', flexShrink: 1 },
  chatSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  messagesList: { padding: 16, gap: 4 },
  msgBubbleWrap: { maxWidth: '80%', marginBottom: 6 },
  msgMe: { alignSelf: 'flex-end' },
  msgThem: { alignSelf: 'flex-start' },
  senderName: { fontSize: 11, color: '#22C55E', fontWeight: '600', marginBottom: 2, paddingHorizontal: 4 },
  msgBubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, paddingBottom: 4 },
  bubbleMe: { backgroundColor: '#22C55E', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#1F2937', borderBottomLeftRadius: 4 },
  msgText: { fontSize: 15, lineHeight: 22 },
  msgTextMe: { color: '#fff' },
  msgTextThem: { color: '#F9FAFB' },
  msgTimeInline: { fontSize: 10, marginTop: 2, textAlign: 'right' },
  msgTimeMe: { color: 'rgba(255,255,255,0.6)' },
  msgTimeThem: { color: '#6B7280' },
  emptyChat: { flex: 1, alignItems: 'center', padding: 32 },
  emptyChatText: { color: '#6B7280', fontSize: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: '#1E1E1E', backgroundColor: '#111827' },
  textInput: { flex: 1, backgroundColor: '#1F2937', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#FFFFFF', fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
