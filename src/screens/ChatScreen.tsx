import React, { useState, useEffect, useCallback } from 'react';
import { GiftedChat, IMessage, Bubble, Send, InputToolbar, Actions } from 'react-native-gifted-chat';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { supabase } from '../config/supabase';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type ChatScreenProps = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

const ChatScreen: React.FC<ChatScreenProps> = ({ navigation, route }) => {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [text, setText] = useState('');
  const insets = useSafeAreaInsets();
  const { receiverId, receiverName, groupId, groupName } = (route.params as any) || {};
  const isDM = !!receiverId;
  const isGroup = !!groupId;

  useEffect(() => {
    // Get current user and then fetch data
    const initializeChat = async () => {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // We need the ID to fetch messages and setup subscription
        await fetchMessages(user.id);
        setupSubscription(user.id);
      } else {
        setIsLoading(false);
      }
    };
    
    initializeChat();

    return () => {
      // Channels are removed automatically on unmount if we keep track of them
      // but here we just use the global removal to be safe.
      supabase.removeAllChannels();
    };
  }, [receiverId, isDM]);

  const setupSubscription = (currentUserId: string) => {
    // Unique channel for this specific chat interaction
    let channelName = 'global_chat';
    if (isDM) channelName = `dm:${[currentUserId, receiverId].sort().join('-')}`;
    else if (isGroup) channelName = `group:${groupId}`;
    
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
      }, payload => {
        const newMessage = payload.new;

        // Client-side filtering logic
        const isTargetedToMe = newMessage.receiver_id === currentUserId;
        const isFromPartner = newMessage.user_id === receiverId;
        const isFromMe = newMessage.user_id === currentUserId;
        const isTargetedToPartner = newMessage.receiver_id === receiverId;
        const isGlobal = !newMessage.receiver_id && !newMessage.group_id;
        const isThisGroup = newMessage.group_id === groupId;

        const shouldShow = isDM 
          ? ((isTargetedToMe && isFromPartner) || (isFromMe && isTargetedToPartner))
          : (isGroup ? isThisGroup : isGlobal);

        if (!shouldShow) return;

        // Format to GiftedChat IMessage
        const formattedMessage: IMessage = {
          _id: newMessage.id,
          text: newMessage.text,
          createdAt: new Date(newMessage.created_at),
          image: newMessage.image_url,
          audio: newMessage.audio_url,
          file: newMessage.file_url,
          fileName: newMessage.file_name,
          user: {
            _id: newMessage.user_id,
            name: newMessage.user_name || 'User',
            avatar: 'https://placeimg.com/140/140/any',
          },
        } as any;

        setMessages(previousMessages => GiftedChat.append(previousMessages, [formattedMessage]));
      })
      .subscribe();
  };

  const fetchMessages = async (currentUserId: string) => {
    let query = supabase
      .from('messages')
      .select('*');

    if (isDM) {
      // Fetch messages where (sender=me AND receiver=them) OR (sender=them AND receiver=me)
      query = query.or(`and(user_id.eq.${currentUserId},receiver_id.eq.${receiverId}),and(user_id.eq.${receiverId},receiver_id.eq.${currentUserId})`);
    } else if (isGroup) {
      query = query.eq('group_id', groupId);
    } else {
      // Global chat: receiver_id is null AND group_id is null
      query = query.filter('receiver_id', 'is', null).filter('group_id', 'is', null);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(50);

    setIsLoading(false);

    if (error) {
      console.error('Error fetching messages:', error);
      if (error.message.includes('relation') || error.message.includes('not exist')) {
        Alert.alert(
          'Database Setup Required',
          'The "messages" table is missing in Supabase. Please run the SQL migration script from the implementation plan.',
          [{ text: 'OK' }]
        );
      }
      return;
    }

    if (data) {
      const formattedMessages = data.map((msg: any) => ({
        _id: msg.id,
        text: msg.text,
        createdAt: new Date(msg.created_at),
        image: msg.image_url,
        audio: msg.audio_url,
        file: msg.file_url,
        fileName: msg.file_name,
        user: {
          _id: msg.user_id,
          name: msg.user_name || 'User',
          avatar: 'https://placeimg.com/140/140/any',
        },
      } as any));
      setMessages(formattedMessages);
    }
  };

  const onSend = useCallback(async (newMessages: IMessage[] = []) => {
    const message = newMessages[0];
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase.from('messages').insert([
      {
        text: message.text,
        user_id: user.id,
        user_name: user.email?.split('@')[0],
        receiver_id: isDM ? receiverId : null,
        group_id: isGroup ? groupId : null,
        image_url: message.image || null,
        audio_url: (message as any).audio || null,
        file_url: (message as any).file || null,
        file_name: (message as any).fileName || null,
      },
    ]);

    if (error) {
      console.error('Error sending message:', error);
      if (error.message.includes('column') && error.message.includes('not exist')) {
        alert('Database Error: Some columns (receiver_id or image_url) are missing from your "messages" table.');
      } else {
        alert('Error sending message: ' + error.message);
      }
    }
  }, [receiverId, userId]);

  // Set chat screen header options dynamically
  React.useLayoutEffect(() => {
    let title = 'Global Chat';
    if (isDM) title = `Chat with ${receiverName}`;
    else if (isGroup) title = groupName || 'Group Chat';

    navigation.setOptions({
      headerTitle: title,
      headerTitleStyle: {
        fontWeight: 'bold',
        color: '#333',
      },
      headerStyle: {
        backgroundColor: '#fff',
      },
      headerLeft: () => (
        <TouchableOpacity style={{ marginLeft: 15 }} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#f57c00" />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity 
          style={{ marginRight: 15 }} 
          onPress={() => {
            Alert.alert(
              'Logout',
              'Are you sure you want to log out?',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Logout', 
                  style: 'destructive',
                  onPress: async () => {
                    await supabase.auth.signOut();
                  }
                },
              ]
            );
          }}
        >
          <Ionicons name="log-out-outline" size={24} color="#666" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const renderBubble = (props: any) => {
    return (
      <Bubble
        {...props}
        wrapperStyle={{
          right: {
            backgroundColor: '#f57c00',
            borderRadius: 15,
            padding: 2,
          },
          left: {
            backgroundColor: '#f0f0f0',
            borderRadius: 15,
            padding: 2,
          },
        }}
        textStyle={{
          right: {
            color: '#fff',
          },
          left: {
            color: '#333',
          },
        }}
      />
    );
  };

  const renderSend = (props: any) => {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
        <TouchableOpacity 
          onPressIn={startRecording} 
          onPressOut={stopRecording}
          style={{ marginRight: 10, marginBottom: 5 }}
        >
          <Ionicons name={isRecording ? "mic" : "mic-outline"} size={28} color={isRecording ? "#ff5252" : "#f57c00"} />
        </TouchableOpacity>
        <Send {...props}>
          <View style={{ marginRight: 10, marginBottom: 5 }}>
            <Ionicons name="send" size={28} color="#f57c00" />
          </View>
        </Send>
      </View>
    );
  };

  const renderMessageAudio = (props: any) => {
    const { currentMessage } = props;
    const [isPlaying, setIsPlaying] = useState(false);
    const [sound, setSound] = useState<Audio.Sound | null>(null);

    const playSound = async () => {
      try {
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

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && !status.isPlaying && status.didJustFinish) {
            setIsPlaying(false);
          }
        });
      } catch (err) {
        console.error('Play sound error', err);
      }
    };

    return (
      <TouchableOpacity 
        onPress={playSound}
        style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          padding: 10,
          backgroundColor: props.position === 'right' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
          borderRadius: 20,
          margin: 5
        }}
      >
        <Ionicons 
          name={isPlaying ? "pause-circle" : "play-circle"} 
          size={32} 
          color={props.position === 'right' ? "#fff" : "#f57c00"} 
        />
        <Text style={{ 
          marginLeft: 5, 
          color: props.position === 'right' ? "#fff" : "#333",
          fontWeight: '500'
        }}>
          Voice Message
        </Text>
      </TouchableOpacity>
    );
  };

  const renderCustomView = (props: any) => {
    const { currentMessage } = props;
    if (currentMessage.file) {
      return (
        <TouchableOpacity 
          style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            padding: 10,
            backgroundColor: props.position === 'right' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
            borderRadius: 10,
            margin: 5
          }}
          onPress={() => Alert.alert('Download', `Downloading ${currentMessage.fileName || 'file'}...`)}
        >
          <Ionicons 
            name="document-attach-outline" 
            size={24} 
            color={props.position === 'right' ? "#fff" : "#f57c00"} 
          />
          <Text style={{ 
            marginLeft: 8, 
            color: props.position === 'right' ? "#fff" : "#333",
            flexShrink: 1
          }}>
            {currentMessage.fileName || 'Document'}
          </Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  const renderInputToolbar = (props: any) => {
    return (
      <InputToolbar
        {...props}
        containerStyle={{
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#eee',
          paddingTop: 5,
        }}
      />
    );
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileExt = uri.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('chat-images')
        .upload(filePath, blob);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(filePath);

      // Send the image message
      onSend([{
        _id: Math.random().toString(),
        text: '',
        createdAt: new Date(),
        user: { _id: userId || '' },
        image: publicUrl,
      }]);

    } catch (error: any) {
      alert('Error uploading image: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    if (uri) uploadAudio(uri);
  };

  const uploadAudio = async (uri: string) => {
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileName = `audio_${Date.now()}.m4a`;
      const filePath = `${userId}/${fileName}`;

      const { error } = await supabase.storage.from('chat-images').upload(filePath, blob);
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(filePath);

      onSend([{
        _id: Math.random().toString(),
        text: '',
        createdAt: new Date(),
        user: { _id: userId || '' },
        audio: publicUrl,
      } as any]);
    } catch (err: any) {
      alert('Error uploading audio: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({});
      if (!result.canceled) {
        uploadFile(result.assets[0].uri, result.assets[0].name);
      }
    } catch (err) {
      console.error('Pick document error', err);
    }
  };

  const uploadFile = async (uri: string, name: string) => {
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filePath = `${userId}/${Date.now()}_${name}`;

      const { error } = await supabase.storage.from('chat-images').upload(filePath, blob);
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(filePath);

      onSend([{
        _id: Math.random().toString(),
        text: `File: ${name}`,
        createdAt: new Date(),
        user: { _id: userId || '' },
        file: publicUrl,
        fileName: name,
      } as any]);
    } catch (err: any) {
      alert('Error uploading file: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const renderActions = (props: any) => {
    return (
      <Actions
        {...props}
        options={{
          ['Send Image']: pickImage,
          ['Send File']: pickDocument,
          ['Cancel']: () => {},
        }}
        icon={() => (
          <Ionicons name="add-circle-outline" size={28} color="#f57c00" />
        )}
      />
    );
  };

  const renderChatEmpty = () => {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', transform: [{ scaleY: -1 }] }}>
        <Ionicons name="chatbubble-ellipses-outline" size={80} color="#eee" />
        <Text style={{ color: '#999', marginTop: 10, fontSize: 16 }}>No messages yet...</Text>
        <Text style={{ color: '#ccc', marginTop: 5, fontSize: 14 }}>Be the first to say hello!</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9fa' }} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={{ flex: 1 }}
      >
        <GiftedChat
          messages={messages}
          onSend={messages => onSend(messages)}
          user={{
            _id: userId || '',
          }}
          textInputProps={{
            value: text,
            onChangeText: setText,
            onSubmitEditing: () => {
              if (text.trim()) {
                onSend([{
                  _id: Math.random().toString(),
                  text: text.trim(),
                  createdAt: new Date(),
                  user: { _id: userId || '' },
                }]);
                setText('');
              }
            },
            blurOnSubmit: false,
          }}
          renderBubble={renderBubble}
          renderLoading={() => (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#f57c00" />
            </View>
          )}
          renderActions={renderActions}
          renderChatEmpty={renderChatEmpty}
          renderMessageAudio={renderMessageAudio}
          renderCustomView={renderCustomView}
        />
      </KeyboardAvoidingView>
      {uploading && (
        <View style={StyleSheet.absoluteFillObject}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={{ color: '#fff', marginTop: 10 }}>Uploading Image...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default ChatScreen;
