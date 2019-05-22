import {addressCompare} from '../../utils/address';

export const isReady = state => state.network.ready;
export const getError = state => state.network.error;
export const getAddress = state => state.network.address;
export const isStatus = state => state.network.isStatus;
export const getTokens = state => state.network.tokens;
export const getBalance = (state, symbol, address) => {
  if (!symbol) {
    return null;
  }
  if (!address || addressCompare(address, state.network.address)) {
    return parseInt(state.network.tokens[symbol].balance, 10);
  }
  return state.network.tokens[symbol].balances ? parseInt(state.network.tokens[symbol].balances[address], 10) : null;
};
export const getTokensWithPositiveBalance = (state) => (
  Object.values(state.network.tokens).filter((token) => token.balance > 0)
);
export const getTokenBySymbol = (state, symbol) => state.network.tokens[symbol];
export const getTokenByAddress = (state, address) => {
  const symbol = Object.keys(state.network.tokens)
                       .find(token => addressCompare(state.network.tokens[token].address, address));
  return state.network.tokens[symbol];
};
export const getStatusContactCode = (state) => state.network.contactCode;
export const getENSError = state => state.network.ensError;
export const getNetwork = state => state.network.network;
