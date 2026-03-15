import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type CreateGroupScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const CreateGroupScreen: React.FC<CreateGroupScreenProps> = ({ navigation }) => {
  const [groupName, setGroupName] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      setUsers((data || []).filter(u => u.id !== user?.id));
    } catch (error: any) {
      Alert.alert('Error', 'Could not fetch users: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    if (selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select at least one member');
      return;
    }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // 1. Create the group
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert([{ name: groupName, created_by: user.id }])
        .select()
        .single();

      if (groupError) throw groupError;

      // 2. Add members (including creator)
      const members = [user.id, ...selectedUsers].map(uId => ({
        group_id: group.id,
        user_id: uId,
      }));

      const { error: memberError } = await supabase
        .from('group_members')
        .insert(members);

      if (memberError) throw memberError;

      Alert.alert('Success', 'Group created successfully!');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', 'Could not create group: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const renderUserItem = ({ item }: { item: any }) => {
    const isSelected = selectedUsers.includes(item.id);
    return (
      <TouchableOpacity 
        style={[styles.userItem, isSelected && styles.selectedItem]} 
        onPress={() => toggleUser(item.id)}
      >
        <Text style={styles.userName}>{item.username || item.email}</Text>
        {isSelected && <Ionicons name="checkmark-circle" size={24} color="#f57c00" />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f57c00" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>New Group</Text>
        <TouchableOpacity 
          style={styles.createButton} 
          onPress={handleCreateGroup}
          disabled={creating}
        >
          {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createButtonText}>Create</Text>}
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Enter group name..."
        value={groupName}
        onChangeText={setGroupName}
      />

      <Text style={styles.subtitle}>Select Members ({selectedUsers.length})</Text>
      
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderUserItem}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20 
  },
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { fontSize: 16, color: '#666', paddingHorizontal: 20, marginBottom: 10 },
  createButton: { 
    backgroundColor: '#f57c00', 
    paddingHorizontal: 20, 
    paddingVertical: 10, 
    borderRadius: 20 
  },
  createButtonText: { color: '#fff', fontWeight: 'bold' },
  input: { 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee', 
    padding: 15, 
    marginHorizontal: 20, 
    fontSize: 18,
    marginBottom: 20
  },
  list: { paddingHorizontal: 20 },
  userItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f9f9f9'
  },
  selectedItem: { backgroundColor: '#fff8f0' },
  userName: { fontSize: 16 }
});

export default CreateGroupScreen;
