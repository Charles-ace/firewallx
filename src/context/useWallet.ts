import { useContext } from 'react';
import { WalletContext } from './WalletContext';

export const useWallet = () => useContext(WalletContext);