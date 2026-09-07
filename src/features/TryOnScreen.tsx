import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Placeholder screen only. Real camera feed + AR overlay logic
// gets added in Phase 2 — do not build camera/CV code here yet.
export default function TryOnScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Camera + AR try-on goes here (Phase 2)</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
    text: { color: '#FFFFFF' },
});