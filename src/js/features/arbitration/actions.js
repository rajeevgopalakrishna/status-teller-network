import {
  ARBITRATION_UNSOLVED,
  GET_DISPUTED_ESCROWS,
  RESOLVE_DISPUTE,
  RESOLVE_DISPUTE_FAILED,
  BUY_LICENSE,
  CANCEL_ARBITRATOR_SELECTION_ACTIONS,
  CHECK_LICENSE_OWNER,
  LOAD_PRICE,
  LOAD_ARBITRATION,
  GET_ARBITRATORS,
  OPEN_DISPUTE,
  CANCEL_DISPUTE,
  REQUEST_ARBITRATOR,
  CANCEL_ARBITRATOR_REQUEST,
  CHANGE_ACCEPT_EVERYONE,
  GET_ARBITRATION_REQUESTS,
  ACCEPT_ARBITRATOR_REQUEST,
  REJECT_ARBITRATOR_REQUEST,
  BLACKLIST_SELLER,
  LOAD_ARBITRATOR_SCORES,
  UNBLACKLIST_SELLER,
  GET_BLACKLISTED_SELLERS,
  GET_FALLBACK_ARBITRATOR,
  IS_FALLBACK_ARBITRATOR
} from './constants';
import ArbitrationLicenseInstance from '../../../embarkArtifacts/contracts/ArbitrationLicenseInstance';
import EscrowInstance from '../../../embarkArtifacts/contracts/EscrowInstance';

export const getDisputedEscrows = (includeFallbackDisputes = null, isArbitrator = false) => ({type: GET_DISPUTED_ESCROWS, includeFallbackDisputes, isArbitrator});

export const resolveDispute = (escrowId, result) => {
  if (result === ARBITRATION_UNSOLVED) {
    return {
      type: RESOLVE_DISPUTE_FAILED,
      result: "Arbitration must have a result"
    };
  }
  return {
    type: RESOLVE_DISPUTE,
    escrowId,
    result,
    toSend: EscrowInstance.methods.setArbitrationResult(escrowId, result)
  };
};

export const openDispute = (escrowId, motive) => ({type: OPEN_DISPUTE, escrowId, toSend: EscrowInstance.methods.openCase(escrowId, motive || '')});

export const cancelDispute = (escrowId) => ({type: CANCEL_DISPUTE, escrowId, toSend: EscrowInstance.methods.cancelArbitration(escrowId)});

export const loadArbitration = (escrowId) => {
  return {type: LOAD_ARBITRATION, escrowId};
};

export const getArbitrators = (address, includeAll) => ({type: GET_ARBITRATORS, address, includeAll});

export const buyLicense = () => ({ type: BUY_LICENSE });

export const loadPrice = () => ({ type: LOAD_PRICE });

export const checkLicenseOwner = () => ({ type: CHECK_LICENSE_OWNER });

export const requestArbitrator = (arbitrator) => ({ type: REQUEST_ARBITRATOR, arbitrator, toSend: ArbitrationLicenseInstance.methods.requestArbitrator(arbitrator) });

export const cancelArbitratorRequest = (arbitrator) => ({type: CANCEL_ARBITRATOR_REQUEST, arbitrator});

export const cancelArbitratorActions = () => ({type: CANCEL_ARBITRATOR_SELECTION_ACTIONS});

export const changeAcceptEveryone = (acceptAny) => ({type: CHANGE_ACCEPT_EVERYONE, acceptAny, toSend: ArbitrationLicenseInstance.methods.changeAcceptAny(acceptAny)});

export const getArbitratorRequests = () => ({type: GET_ARBITRATION_REQUESTS});

export const acceptRequest = (id) => ({type: ACCEPT_ARBITRATOR_REQUEST, id, toSend: ArbitrationLicenseInstance.methods.acceptRequest(id)});

export const rejectRequest = (id) => ({type: REJECT_ARBITRATOR_REQUEST, id, toSend: ArbitrationLicenseInstance.methods.rejectRequest(id)});

export const getBlacklistedSellers = () => ({type: GET_BLACKLISTED_SELLERS});

export const blacklistSeller = (sellerAddress) => ({type: BLACKLIST_SELLER, sellerAddress, toSend: ArbitrationLicenseInstance.methods.blacklistSeller(sellerAddress)});

export const unBlacklistSeller = (sellerAddress) => ({type: UNBLACKLIST_SELLER, sellerAddress, toSend: ArbitrationLicenseInstance.methods.unBlacklistSeller(sellerAddress)});

export const loadArbitratorScores = () => ({type: LOAD_ARBITRATOR_SCORES});

export const getFallbackArbitrator = () => ({type: GET_FALLBACK_ARBITRATOR});

export const checkIfFallbackArbitrator = () => ({type: IS_FALLBACK_ARBITRATOR});
