import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email ?? null);
      }
      setIsLoading(false);
    };
    fetchUser();
  }, []);

  const onSignOut = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
              console.log('Error logging out: ', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          }
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f57c00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <View style={styles.avatarPlaceholder}>
             <Ionicons name="person" size={40} color="#f57c00" />
          </View>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userEmail}>{userEmail || 'Guest'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onSignOut}>
          <Ionicons name="log-out-outline" size={28} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Quick Access</Text>
        
        <TouchableOpacity 
          style={styles.chatCard} 
          onPress={() => navigation.navigate('Chat')}
        >
          <View style={styles.chatCardIcon}>
            <Ionicons name="chatbubbles" size={32} color="#fff" />
          </View>
          <View style={styles.chatCardInfo}>
            <Text style={styles.chatCardTitle}>Global Chat Room</Text>
            <Text style={styles.chatCardSubtitle}>Connect with everyone online</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.chatCard} 
          onPress={() => navigation.navigate('Users')}
        >
          <View style={[styles.chatCardIcon, { backgroundColor: '#4a90e2' }]}>
            <Ionicons name="people" size={32} color="#fff" />
          </View>
          <View style={styles.chatCardInfo}>
            <Text style={styles.chatCardTitle}>Direct Messages</Text>
            <Text style={styles.chatCardSubtitle}>Chat one-on-one with friends</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.chatCard} 
          onPress={() => navigation.navigate('Groups')}
        >
          <View style={[styles.chatCardIcon, { backgroundColor: '#9c27b0' }]}>
            <Ionicons name="chatbubble-ellipses" size={32} color="#fff" />
          </View>
          <View style={styles.chatCardInfo}>
            <Text style={styles.chatCardTitle}>Group Chats</Text>
            <Text style={styles.chatCardSubtitle}>View and manage your groups</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.chatCard} 
          onPress={() => navigation.navigate('CreateGroup')}
        >
          <View style={[styles.chatCardIcon, { backgroundColor: '#5bc0de' }]}>
            <Ionicons name="add-circle" size={32} color="#fff" />
          </View>
          <View style={styles.chatCardInfo}>
            <Text style={styles.chatCardTitle}>Create Group</Text>
            <Text style={styles.chatCardSubtitle}>Start a new group conversation</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.chatCard, { marginTop: 20, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 20 }]} 
          onPress={onSignOut}
        >
          <View style={[styles.chatCardIcon, { backgroundColor: '#ff5252' }]}>
            <Ionicons name="log-out" size={32} color="#fff" />
          </View>
          <View style={styles.chatCardInfo}>
            <Text style={[styles.chatCardTitle, { color: '#ff5252' }]}>Logout</Text>
            <Text style={styles.chatCardSubtitle}>Sign out of your account</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff3e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#ffe0b2',
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
  },
  userEmail: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  chatCardIcon: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#f57c00',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  chatCardInfo: {
    flex: 1,
  },
  chatCardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  chatCardSubtitle: {
    fontSize: 13,
    color: '#888',
  },
});

export default HomeScreen;
