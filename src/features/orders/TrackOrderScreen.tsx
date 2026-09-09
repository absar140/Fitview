import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';

// Mock static order steps — replace with real order status data
// fetched by order ID once a backend exists.
const steps = [
  { label: 'order placed', done: true },
  { label: 'processing', done: true },
  { label: 'shipped', done: false },
  { label: 'out for delivery', done: false },
  { label: 'delivered', done: false },
];

export default function TrackOrderScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.header}>track order</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={styles.orderId}>order #49281</Text>

      <View style={styles.timeline}>
        {steps.map((step, index) => (
          <View key={step.label} style={styles.stepRow}>
            <View style={styles.dotColumn}>
              <View style={[styles.dot, step.done && styles.dotDone]} />
              {index < steps.length - 1 && (
                <View style={[styles.line, step.done && styles.lineDone]} />
              )}
            </View>
            <Text style={[styles.stepLabel, step.done && styles.stepLabelDone]}>{step.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 56, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  backIcon: { fontSize: 24, color: '#1A1A1A' },
  header: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  orderId: { fontSize: 13, color: '#8A8778', marginBottom: 24 },
  timeline: { marginTop: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start' },
  dotColumn: { alignItems: 'center', width: 24 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#D9D6CC' },
  dotDone: { backgroundColor: '#3A7D44' },
  line: { width: 2, height: 36, backgroundColor: '#D9D6CC' },
  lineDone: { backgroundColor: '#3A7D44' },
  stepLabel: { fontSize: 14, color: '#8A8778', marginLeft: 12, marginTop: -2 },
  stepLabelDone: { color: '#1A1A1A', fontWeight: '600' },
});