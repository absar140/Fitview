import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FilamentScene, FilamentView, Model, Camera, DefaultLight } from 'react-native-filament';

export default function FilamentTestScreen() {
  return (
    <View style={styles.container}>
      {/* FilamentScene 3D environment create karta hai */}
      <FilamentScene>
        {/* FilamentView asal mein screen par render karta hai */}
        <FilamentView style={styles.container}>
          {/* Camera 3D scene ko dekhne ke liye zaroori hai */}
          <Camera cameraPosition={[0, 0, 3]} /> 
          
          {/* Light ke bina model bilkul kala (black) nazar aayega */}
          <DefaultLight />
          
          {/* Yahan hum apna GLB model load kar rahe hain */}
          <Model 
  source={require('../../../assets/garments/shirt.glb')} 
  scale={[1, 1, 1]}
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