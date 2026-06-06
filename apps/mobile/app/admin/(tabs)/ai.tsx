import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { superAdminApi } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  { label: '📊 Platform overview', prompt: 'Give me a comprehensive overview of the platform health and any issues that need attention.' },
  { label: '💰 Revenue analysis', prompt: 'Analyze the revenue trends. How is today performing compared to the monthly average? Any concerns?' },
  { label: '🏟 Top venues', prompt: 'Which pitches are performing best and which ones need attention?' },
  { label: '👥 User activity', prompt: 'How is user engagement looking? Who are the most active users and what trends do you see?' },
  { label: '⚽ Match insights', prompt: 'What can you tell me about match activity and booking patterns?' },
  { label: '⚠️ Issues & alerts', prompt: 'Are there any anomalies or issues that require immediate admin attention?' },
];

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const time = message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <View className={`mb-3 ${isUser ? 'items-end' : 'items-start'}`}>
      {!isUser && (
        <View className="flex-row items-center mb-1 ml-1">
          <View className="w-6 h-6 rounded-full bg-purple-600 items-center justify-center mr-1">
            <Text style={{ fontSize: 10 }}>✨</Text>
          </View>
          <Text className="text-purple-400 text-xs font-medium">Gemini AI</Text>
        </View>
      )}
      <View
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 rounded-tr-sm'
            : 'bg-gray-800 rounded-tl-sm'
        }`}
      >
        <Text className="text-white text-sm leading-5">{message.text}</Text>
      </View>
      <Text className="text-gray-600 text-xs mt-1 mx-1">{time}</Text>
    </View>
  );
}

export default function AdminAiScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      text: "Hi! I'm your ScoreWithUs AI assistant powered by Gemini. I have access to live platform data — ask me anything about users, pitches, revenue, or platform health.\n\nTry one of the quick prompts below to get started.",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setShowQuickPrompts(false);
    setLoading(true);
    scrollToBottom();

    try {
      const { data } = await superAdminApi.aiChat(trimmed);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: data.text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: err?.response?.data?.message ?? 'Failed to get response. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [loading, scrollToBottom]);

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Chat',
      'This will clear the conversation history and start a fresh session with updated system data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await superAdminApi.aiResetChat();
            } catch {
              // Ignore error — reset UI regardless
            }
            setMessages([
              {
                id: '0',
                role: 'assistant',
                text: "Chat reset! I've refreshed my system data context. What would you like to explore?",
                timestamp: new Date(),
              },
            ]);
            setShowQuickPrompts(true);
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-black"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-3 border-b border-gray-800">
        <View className="flex-row items-center gap-2">
          <View className="w-9 h-9 rounded-full bg-purple-600 items-center justify-center">
            <Text style={{ fontSize: 18 }}>✨</Text>
          </View>
          <View>
            <Text className="text-white font-bold text-base">Gemini AI</Text>
            <Text className="text-gray-400 text-xs">Platform intelligence</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={handleReset}
          className="px-3 py-1.5 rounded-full border border-gray-700"
        >
          <Text className="text-gray-400 text-xs">Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        className="flex-1 px-4 pt-4"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {loading && (
          <View className="items-start mb-3">
            <View className="flex-row items-center mb-1 ml-1">
              <View className="w-6 h-6 rounded-full bg-purple-600 items-center justify-center mr-1">
                <Text style={{ fontSize: 10 }}>✨</Text>
              </View>
              <Text className="text-purple-400 text-xs font-medium">Gemini AI</Text>
            </View>
            <View className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
              <ActivityIndicator size="small" color="#a855f7" />
            </View>
          </View>
        )}

        {/* Quick prompts */}
        {showQuickPrompts && !loading && (
          <View className="mb-4">
            <Text className="text-gray-500 text-xs mb-2 ml-1">Quick prompts</Text>
            <View className="flex-row flex-wrap gap-2">
              {QUICK_PROMPTS.map((qp) => (
                <TouchableOpacity
                  key={qp.label}
                  onPress={() => handleQuickPrompt(qp.prompt)}
                  className="bg-gray-900 border border-gray-700 rounded-full px-3 py-2"
                >
                  <Text className="text-gray-300 text-xs">{qp.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View className="h-4" />
      </ScrollView>

      {/* Input */}
      <View className="px-4 py-3 border-t border-gray-800 flex-row items-end gap-2">
        <View className="flex-1 bg-gray-900 rounded-2xl border border-gray-700 px-4 py-3 min-h-[44px] max-h-[120px]">
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about platform data..."
            placeholderTextColor="#6b7280"
            className="text-white text-sm"
            multiline
            onSubmitEditing={() => sendMessage(inputText)}
            returnKeyType="send"
            blurOnSubmit
          />
        </View>
        <TouchableOpacity
          onPress={() => sendMessage(inputText)}
          disabled={loading || !inputText.trim()}
          className={`w-11 h-11 rounded-full items-center justify-center ${
            loading || !inputText.trim() ? 'bg-gray-800' : 'bg-purple-600'
          }`}
        >
          <Text className="text-white" style={{ fontSize: 18 }}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
