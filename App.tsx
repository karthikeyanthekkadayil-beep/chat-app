import React, { useEffect } from 'react';
import RootNavigator from './src/navigation/RootNavigator';
import * as Linking from 'expo-linking';
import { supabase } from './src/config/supabase';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  useEffect(() => {
    const handleDeepLink = (url: string | null) => {
      if (!url) return;
      const { queryParams } = Linking.parse(url);
      if (queryParams) {
        // Supabase-js handles session detection automatically if detectSessionInUrl is true
      }
    };

    const subscription = Linking.addEventListener('url', (event: { url: string }) => {
      handleDeepLink(event.url);
    });

    Linking.getInitialURL().then((url: string | null) => {
      handleDeepLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}
