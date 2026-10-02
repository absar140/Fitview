import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FilamentScene, FilamentView, Model, Camera, DefaultLight } from 'react-native-filament';

export default function FilamentTestScreen() {
  return (
    <View style={styles.container}>
      <FilamentScene>
        <FilamentView style={styles.container}>
          <Camera cameraPosition={[0, 0, 3]} />
          <DefaultLight />
          <Model
            source={require('../../../assets/garments/shirt1.glb')}
            transformToUnitCube
          />
        </FilamentView>
      </FilamentScene>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
});