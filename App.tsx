import React from 'react';
import RootNavigator from './src/navigation/RootNavigator';
import { CartProvider } from './src/store/CartContext';

export default function App() {
  return (
    <CartProvider>
      <RootNavigator />
    </CartProvider>
  );
}