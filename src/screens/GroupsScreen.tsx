import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type GroupsScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const GroupsScreen: React.FC<GroupsScreenProps> = ({ navigation }) => {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch groups where the user is a member
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups (
            id,
            name,
            created_at
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const formattedGroups = data.map((item: any) => item.groups).filter(Boolean);
      setGroups(formattedGroups);
    } catch (error: any) {
      Alert.alert('Error', 'Could not fetch groups: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderGroupItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.groupItem} 
      onPress={() => navigation.navigate('Chat', { groupId: item.id, groupName: item.name })}
    >
      <View style={styles.groupIcon}>
        <Ionicons name="people" size={28} color="#fff" />
      </View>
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.groupMeta}>Created {new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Groups</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CreateGroup')}>
          <Ionicons name="add-circle" size={32} color="#f57c00" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroupItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={80} color="#eee" />
            <Text style={styles.emptyText}>You haven't joined any groups yet.</Text>
            <TouchableOpacity 
              style={styles.createBtn} 
              onPress={() => navigation.navigate('CreateGroup')}
            >
              <Text style={styles.createBtnText}>Create a Group</Text>
            </TouchableOpacity>
          </View>
        )}
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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  list: { paddingHorizontal: 20, paddingTop: 10 },
  groupItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f9f9f9'
  },
  groupIcon: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    backgroundColor: '#f57c00', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 15
  },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 18, fontWeight: '600', color: '#333' },
  groupMeta: { fontSize: 13, color: '#999', marginTop: 2 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#999', marginTop: 15, fontSize: 16, textAlign: 'center' },
  createBtn: { 
    marginTop: 20, 
    backgroundColor: '#f57c00', 
    paddingHorizontal: 25, 
    paddingVertical: 12, 
    borderRadius: 25 
  },
  createBtnText: { color: '#fff', fontWeight: 'bold' }
});

export default GroupsScreen;
