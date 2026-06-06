import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth.store';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, setAuth } = useAuthStore();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState((user as any)?.firstName ?? '');
  const [lastName, setLastName] = useState((user as any)?.lastName ?? '');
  const [bio, setBio] = useState((user as any)?.bio ?? '');

  const mutation = useMutation({
    mutationFn: () => usersApi.updateMe({ firstName, lastName, bio }),
    onSuccess: async () => {
      const { data: updated } = await usersApi.getMe();
      const { accessToken, refreshToken } = useAuthStore.getState();
      setAuth(updated, accessToken!, refreshToken!);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      router.back();
    },
    onError: () => Alert.alert('Error', 'Failed to update profile'),
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity onPress={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <ActivityIndicator color="#22C55E" /> : <Text style={styles.save}>Save</Text>}
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scroll}>
        <View style={styles.field}>
          <Text style={styles.label}>First Name</Text>
          <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholderTextColor="#6B7280" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Last Name</Text>
          <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholderTextColor="#6B7280" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            value={bio}
            onChangeText={setBio}
            multiline
            placeholderTextColor="#6B7280"
            placeholder="Tell other players about yourself..."
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0D0D' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  back: { color: '#22C55E', fontSize: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  save: { color: '#22C55E', fontSize: 16, fontWeight: '600' },
  scroll: { padding: 16 },
  field: { marginBottom: 20 },
  label: { color: '#9CA3AF', fontSize: 13, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#1F2937', color: '#fff', borderRadius: 10, padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#374151' },
});
