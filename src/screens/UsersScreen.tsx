import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Alert } from 'react-native';
import { supabase } from '../config/supabase';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type UsersScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const UsersScreen: React.FC<UsersScreenProps> = ({ navigation }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Get unique partner IDs from the messages table
      // We want messages where (I am sender OR I am receiver) AND it's a DM (receiver_id is not null)
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .select('user_id, receiver_id')
        .or(`user_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .not('receiver_id', 'is', null);

      if (messageError) {
        console.log('Error fetching message history:', messageError.message);
        setUsers([]);
        setFilteredUsers([]);
        return;
      }

      // 2. Extract unique IDs of people I've talked to
      const partnerIds = new Set<string>();
      messageData?.forEach(msg => {
        if (msg.user_id !== user.id) partnerIds.add(msg.user_id);
        if (msg.receiver_id && msg.receiver_id !== user.id) partnerIds.add(msg.receiver_id);
      });

      if (partnerIds.size === 0) {
        setUsers([]);
        setFilteredUsers([]);
        return;
      }

      // 3. Fetch profiles for these IDs
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('id', Array.from(partnerIds));

      if (error) {
        console.log('Error fetching partner profiles:', error.message);
        Alert.alert('Error', 'Could not load your contacts.');
        setUsers([]);
        setFilteredUsers([]);
      } else {
        setUsers(data || []);
        setFilteredUsers(data || []);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user => {
        const name = (user.username || user.email || '').toLowerCase();
        return name.includes(query.toLowerCase());
      });
      setFilteredUsers(filtered);
    }
  };

  const renderUserItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.userCard}
      onPress={() => navigation.navigate('Chat', { receiverId: item.id, receiverName: item.username || item.email })}
    >
      <View style={styles.avatar}>
        <Ionicons name="person" size={24} color="#f57c00" />
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.username || item.email || 'Anonymous User'}</Text>
        <Text style={styles.userStatus}>Online</Text>
      </View>
      <Ionicons name="chatbubble-ellipses-outline" size={24} color="#f57c00" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f57c00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={20} color="#ccc" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUserItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No matching contacts found.' : 'No conversations yet.'}
            </Text>
            {!searchQuery && (
              <>
                <Text style={styles.emptySubtext}>
                  Conversations you start will appear here. Start a chat from a profile or Global Chat!
                </Text>
                <TouchableOpacity 
                  style={styles.retryButton} 
                  onPress={() => navigation.navigate('Chat')}
                >
                  <Text style={styles.retryText}>Go to Global Chat</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 15,
    paddingTop: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 15,
    paddingHorizontal: 15,
    borderRadius: 12,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff3e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  userStatus: {
    fontSize: 12,
    color: '#4caf50',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 40,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#f57c00',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default UsersScreen;
