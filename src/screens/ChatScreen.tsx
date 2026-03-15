import React, { useState, useEffect, useCallback } from 'react';
import { GiftedChat, IMessage, Bubble, Send, Actions } from 'react-native-gifted-chat';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

// Safe Audio import with type guards
let Audio: any;
try {
  Audio = require('expo-av').Audio;
} catch (e) {
  Audio = null;
}

// --- Sub-Components to handle hooks correctly ---

const AudioMessage = ({ currentMessage, position }: any) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState<any>(null);

  const playSound = async () => {
    try {
      if (!Audio || !Audio.Sound) {
        Alert.alert('Native Module Error', 'Audio support is not available in your current version of Expo Go.');
        return;
      }
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
        return;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: currentMessage.audio },
        { shouldPlay: true }
      );
      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && !status.isPlaying && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (err) {
      console.error('Play sound error', err);
    }
  };

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  return (
    <TouchableOpacity 
      onPress={playSound} 
      style={[styles.audioBubble, { backgroundColor: position === 'right' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)' }]}
    >
      <Ionicons 
        name={isPlaying ? "pause-circle" : "play-circle"} 
        size={32} 
        color={position === 'right' ? "#fff" : "#f57c00"} 
      />
      <Text style={[styles.audioText, { color: position === 'right' ? "#fff" : "#333" }]}>
        Voice Message
      </Text>
    </TouchableOpacity>
  );
};

// --- Main Screen Component ---

type ChatScreenProps = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

const ChatScreen: React.FC<ChatScreenProps> = ({ navigation, route }) => {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [text, setText] = useState('');
  
  const insets = useSafeAreaInsets();
  const { receiverId, receiverName, groupId, groupName } = (route.params as any) || {};
  const isDM = !!receiverId;
  const isGroup = !!groupId;

  useEffect(() => {
    const initializeChat = async () => {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        await fetchMessages(user.id);
        setupSubscription(user.id);
      } else {
        setIsLoading(false);
      }
    };
    
    initializeChat();

    return () => {
      supabase.removeAllChannels();
    };
  }, [receiverId, groupId]);

  const setupSubscription = (currentUserId: string) => {
    let channelName = isDM ? `dm:${[currentUserId, receiverId].sort().join('-')}` : (isGroup ? `group:${groupId}` : 'global_chat');
    
    supabase.channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new;
        
        const isTargetedToMe = msg.receiver_id === currentUserId;
        const isFromPartner = msg.user_id === receiverId;
        const isFromMe = msg.user_id === currentUserId;
        const isTargetedToPartner = msg.receiver_id === receiverId;
        const isGlobal = !msg.receiver_id && !msg.group_id;
        const isThisGroup = msg.group_id === groupId;

        const shouldShow = isDM 
          ? ((isTargetedToMe && isFromPartner) || (isFromMe && isTargetedToPartner))
          : (isGroup ? isThisGroup : isGlobal);

        if (!shouldShow) return;

        const formatted: IMessage = {
          _id: msg.id,
          text: msg.text,
          createdAt: new Date(msg.created_at),
          image: msg.image_url,
          audio: msg.audio_url,
          user: {
            _id: msg.user_id,
            name: msg.user_name || 'User',
          },
        } as any;
        if (msg.file_url) (formatted as any).file = msg.file_url;
        if (msg.file_name) (formatted as any).fileName = msg.file_name;

        setMessages(prev => GiftedChat.append(prev, [formatted]));
      })
      .subscribe();
  };

  const fetchMessages = async (currentUserId: string) => {
    let query = supabase.from('messages').select('*');
    if (isDM) query = query.or(`and(user_id.eq.${currentUserId},receiver_id.eq.${receiverId}),and(user_id.eq.${receiverId},receiver_id.eq.${currentUserId})`);
    else if (isGroup) query = query.eq('group_id', groupId);
    else query = query.filter('receiver_id', 'is', null).filter('group_id', 'is', null);

    const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
    setIsLoading(false);
    if (error) return console.error(error);

    if (data) {
      setMessages(data.map((msg: any) => ({
        _id: msg.id,
        text: msg.text,
        createdAt: new Date(msg.created_at),
        image: msg.image_url,
        audio: msg.audio_url,
        file: msg.file_url,
        fileName: msg.file_name,
        user: { _id: msg.user_id, name: msg.user_name || 'User' },
      } as any)));
    }
  };

  const onSend = useCallback(async (newMessages: IMessage[] = []) => {
    const msg = newMessages[0];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('messages').insert([{
      text: msg.text || '',
      user_id: user.id,
      user_name: user.email?.split('@')[0],
      receiver_id: isDM ? receiverId : null,
      group_id: isGroup ? groupId : null,
      image_url: msg.image || null,
      audio_url: (msg as any).audio || null,
      file_url: (msg as any).file || null,
      file_name: (msg as any).fileName || null,
    }]);

    if (error) Alert.alert('Error', error.message);
  }, [receiverId, groupId, isDM, isGroup]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: isDM ? `Chat with ${receiverName}` : (isGroup ? groupName : 'Global Chat'),
      headerLeft: () => (
        <TouchableOpacity style={{ marginLeft: 15 }} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#f57c00" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, receiverName, groupName, isDM, isGroup]);

  // --- Media Handlers ---

  const startRecording = async () => {
    try {
      if (!Audio || !Audio.Recording) {
        Alert.alert('Native Module Error', 'Recording is not available in your current version of Expo Go. Please make sure you are using the latest Expo Go app.');
        return;
      }
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
    } catch (err) { console.error(err); }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    if (uri) uploadMedia(uri, 'audio');
  };

  const uploadMedia = async (uri: string, type: 'image' | 'audio' | 'file', originalName?: string) => {
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = uri.split('.').pop();
      const name = originalName || `${type}_${Date.now()}.${ext}`;
      const path = `${userId}/${name}`;

      const { error } = await supabase.storage.from('chat-images').upload(path, blob);
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(path);

      const msg: any = {
        _id: Math.random().toString(),
        text: type === 'file' ? `File: ${name}` : '',
        createdAt: new Date(),
        user: { _id: userId || '' },
      };

      if (type === 'image') msg.image = publicUrl;
      if (type === 'audio') msg.audio = publicUrl;
      if (type === 'file') { msg.file = publicUrl; msg.fileName = name; }

      onSend([msg]);
    } catch (err: any) {
      Alert.alert('Upload Error', err.message);
    } finally {
      setUploading(false);
    }
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled) uploadMedia(res.assets[0].uri, 'image');
  };

  const pickDocument = async () => {
    const res = await DocumentPicker.getDocumentAsync({});
    if (!res.canceled) uploadMedia(res.assets[0].uri, 'file', res.assets[0].name);
  };

  // --- Renderers ---

  const renderBubble = (props: any) => (
    <Bubble {...props} wrapperStyle={{ right: { backgroundColor: '#f57c00' }, left: { backgroundColor: '#f0f0f0' } }} />
  );

  const renderMessageAudio = (props: any) => <AudioMessage {...props} />;

  const downloadAndShareFile = async (url: string, fileName: string) => {
    try {
      setUploading(true);
      const fileUri = `${(FileSystem as any).cacheDirectory}${fileName}`;
      const downloadResumable = FileSystem.createDownloadResumable(url, fileUri);
      const result = await downloadResumable.downloadAsync();
      
      setUploading(false);
      if (result) {
        await Sharing.shareAsync(result.uri);
      }
    } catch (err: any) {
      setUploading(false);
      Alert.alert('Download Error', err.message);
    }
  };

  const renderCustomView = (props: any) => {
    if (props.currentMessage.file) {
      return (
        <TouchableOpacity 
          style={styles.fileBubble} 
          onPress={() => downloadAndShareFile(props.currentMessage.file, props.currentMessage.fileName)}
        >
          <Ionicons name="document-attach" size={24} color={props.position === 'right' ? "#fff" : "#f57c00"} />
          <Text style={[styles.fileText, { color: props.position === 'right' ? "#fff" : "#333" }]}>{props.currentMessage.fileName}</Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  const renderActions = (props: any) => (
    <Actions {...props} options={{ 'Send Image': pickImage, 'Send File': pickDocument, 'Cancel': () => {} }}
      icon={() => <Ionicons name="add-circle" size={28} color="#f57c00" />} />
  );

  const renderSend = (props: any) => (
    <View style={styles.sendRow}>
      <TouchableOpacity onPressIn={startRecording} onPressOut={stopRecording} style={styles.micBtn}>
        <Ionicons name={isRecording ? "mic" : "mic-outline"} size={28} color={isRecording ? "#ff5252" : "#f57c00"} />
      </TouchableOpacity>
      <Send {...props}>
        <Ionicons name="send" size={28} color="#f57c00" style={styles.sendBtn} />
      </Send>
    </View>
  );

  if (isLoading) return <View style={styles.centered}><ActivityIndicator size="large" color="#f57c00" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90} style={{ flex: 1 }}>
        <GiftedChat
          messages={messages}
          onSend={msgs => onSend(msgs)}
          user={{ _id: userId || '' }}
          textInputProps={{ value: text, onChangeText: setText }}
          renderBubble={renderBubble}
          renderActions={renderActions}
          renderSend={renderSend}
          renderMessageAudio={renderMessageAudio}
          renderCustomView={renderCustomView}
          renderChatEmpty={() => (
            <ScrollView contentContainerStyle={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={80} color="#eee" />
              <Text style={styles.emptyText}>No messages yet...</Text>
            </ScrollView>
          )}
        />
      </KeyboardAvoidingView>
      {uploading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.overlayText}>Uploading...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  audioBubble: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 20, margin: 5 },
  audioText: { marginLeft: 5, fontWeight: '500' },
  fileBubble: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, margin: 5 },
  fileText: { marginLeft: 8, flexShrink: 1, fontSize: 13 },
  sendRow: { flexDirection: 'row', alignItems: 'center', height: 44 },
  micBtn: { marginRight: 10, marginBottom: 5 },
  sendBtn: { marginRight: 10, marginBottom: 5 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', transform: [{ scaleY: -1 }] },
  emptyText: { color: '#999', marginTop: 10, fontSize: 16 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  overlayText: { color: '#fff', marginTop: 10 }
});

export default ChatScreen;
