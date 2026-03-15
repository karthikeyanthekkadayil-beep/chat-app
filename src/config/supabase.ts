import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// TODO: Replace these with your actual Supabase project configuration
const supabaseUrl = 'https://aynwfwsqxijdqbvqjibp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5bndmd3NxeGlqZHFidnFqaWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NTI0NjcsImV4cCI6MjA4OTEyODQ2N30.559tHKvb1i0TmKvFOWzunGXzTmS-yDTmsQK9akBtAYg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
