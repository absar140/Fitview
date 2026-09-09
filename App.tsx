import React from 'react';
import RootNavigator from './src/navigation/RootNavigator';
import { CartProvider } from './src/store/CartContext';
import { AuthProvider } from './src/store/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <RootNavigator />
      </CartProvider>
    </AuthProvider>
  );
}