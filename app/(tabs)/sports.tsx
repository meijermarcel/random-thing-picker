import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export default function Sports() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.text}>Sports Picks Coming Soon</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
    color: '#888',
  },
});
