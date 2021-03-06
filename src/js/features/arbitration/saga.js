/* global web3, subspace */
import ArbitrationLicenseInstance from '../../../embarkArtifacts/contracts/ArbitrationLicenseInstance';
import EscrowInstance from '../../../embarkArtifacts/contracts/EscrowInstance';
import OfferStoreInstance from '../../../embarkArtifacts/contracts/OfferStoreInstance';
import SNT from '../../../embarkArtifacts/contracts/SNT';
import GnosisSafe from '../../../embarkArtifacts/contracts/GnosisSafe';
import moment from 'moment';
import {promiseEventEmitter, doTransaction} from '../../utils/saga';
import {eventChannel, channel} from "redux-saga";
import {fork, takeEvery, call, put, take, all} from 'redux-saga/effects';
import {addressCompare} from '../../utils/address';
import {
  CLOSED, NONE,
  GET_DISPUTED_ESCROWS, GET_DISPUTED_ESCROWS_FAILED, GET_DISPUTED_ESCROWS_SUCCEEDED,
  RESOLVE_DISPUTE, RESOLVE_DISPUTE_FAILED, RESOLVE_DISPUTE_SUCCEEDED,
  RESOLVE_DISPUTE_PRE_SUCCESS, LOAD_ARBITRATION, LOAD_ARBITRATION_FAILED, LOAD_ARBITRATION_SUCCEEDED, GET_ARBITRATORS,
  GET_ARBITRATORS_SUCCEEDED, GET_ARBITRATORS_FAILED, BUY_LICENSE, BUY_LICENSE_FAILED, BUY_LICENSE_PRE_SUCCESS, BUY_LICENSE_SUCCEEDED,
  LOAD_PRICE, LOAD_PRICE_FAILED, LOAD_PRICE_SUCCEEDED, CHECK_LICENSE_OWNER, CHECK_LICENSE_OWNER_FAILED, CHECK_LICENSE_OWNER_SUCCEEDED,
  OPEN_DISPUTE, OPEN_DISPUTE_SUCCEEDED, OPEN_DISPUTE_FAILED, OPEN_DISPUTE_PRE_SUCCESS,
  CANCEL_DISPUTE, CANCEL_DISPUTE_PRE_SUCCESS, CANCEL_DISPUTE_SUCCEEDED, CANCEL_DISPUTE_FAILED,
  REQUEST_ARBITRATOR, REQUEST_ARBITRATOR_PRE_SUCCESS, REQUEST_ARBITRATOR_SUCCEEDED, REQUEST_ARBITRATOR_FAILED,
  CANCEL_ARBITRATOR_REQUEST, CANCEL_ARBITRATOR_REQUEST_SUCCEEDED, CANCEL_ARBITRATOR_REQUEST_FAILED, CANCEL_ARBITRATOR_REQUEST_PRE_SUCCESS,
  CHANGE_ACCEPT_EVERYONE, CHANGE_ACCEPT_EVERYONE_PRE_SUCCESS, CHANGE_ACCEPT_EVERYONE_FAILED, CHANGE_ACCEPT_EVERYONE_SUCCEEDED,
  GET_ARBITRATION_REQUESTS, GET_ARBITRATION_REQUESTS_FAILED, GET_ARBITRATION_REQUESTS_SUCCEEDED,
  ACCEPT_ARBITRATOR_REQUEST, ACCEPT_ARBITRATOR_REQUEST_PRE_SUCCESS, ACCEPT_ARBITRATOR_REQUEST_SUCCEEDED, ACCEPT_ARBITRATOR_REQUEST_FAILED,
  REJECT_ARBITRATOR_REQUEST, REJECT_ARBITRATOR_REQUEST_PRE_SUCCESS, REJECT_ARBITRATOR_REQUEST_SUCCEEDED, REJECT_ARBITRATOR_REQUEST_FAILED,
  BLACKLIST_SELLER, BLACKLIST_SELLER_PRE_SUCCESS, BLACKLIST_SELLER_FAILED, BLACKLIST_SELLER_SUCCEEDED,
  UNBLACKLIST_SELLER, UNBLACKLIST_SELLER_FAILED, UNBLACKLIST_SELLER_PRE_SUCCESS, UNBLACKLIST_SELLER_SUCCEEDED,
  GET_FALLBACK_ARBITRATOR, GET_FALLBACK_ARBITRATOR_FAILED, GET_FALLBACK_ARBITRATOR_SUCCEEDED,
  GET_BLACKLISTED_SELLERS, GET_BLACKLISTED_SELLERS_FAILED, GET_BLACKLISTED_SELLERS_SUCCEEDED, LOAD_ARBITRATOR_SCORES, RESET_ARBITRATOR_SCORES, ADD_ARBITRATOR_SCORE,
  IS_FALLBACK_ARBITRATOR, IS_FALLBACK_ARBITRATOR_SUCCEEDED, IS_FALLBACK_ARBITRATOR_FAILED
} from './constants';

export function *onResolveDispute() {
  yield takeEvery(RESOLVE_DISPUTE, doTransaction.bind(null, RESOLVE_DISPUTE_PRE_SUCCESS, RESOLVE_DISPUTE_SUCCEEDED, RESOLVE_DISPUTE_FAILED));
}

export function *onOpenDispute() {
  yield takeEvery(OPEN_DISPUTE, doTransaction.bind(null, OPEN_DISPUTE_PRE_SUCCESS, OPEN_DISPUTE_SUCCEEDED, OPEN_DISPUTE_FAILED));
}

export function *onCancelDispute() {
  yield takeEvery(CANCEL_DISPUTE, doTransaction.bind(null, CANCEL_DISPUTE_PRE_SUCCESS, CANCEL_DISPUTE_SUCCEEDED, CANCEL_DISPUTE_FAILED));
}

export function *doLoadArbitratorScores() {
  yield put({type: RESET_ARBITRATOR_SCORES});

  const TrackableEscrow = subspace.contract(EscrowInstance);
  const myArbitration$ = yield TrackableEscrow.events.ArbitrationResolved.track();

  const arbChannel = channel();
  myArbitration$.subscribe(x => arbChannel.put(x.arbitrator));

  while (true) {
    const arbitrator = yield take(arbChannel);
    yield put({type: ADD_ARBITRATOR_SCORE, arbitrator});
  }
}

export function *doGetArbitrators({address, includeAll}) {
  try {
    const cnt = yield call(ArbitrationLicenseInstance.methods.getNumLicenseOwners().call);
    const arbitrators = {};
    for(let i = 0; i < cnt; i++){
      const arbitrator = web3.utils.toChecksumAddress(yield call(ArbitrationLicenseInstance.methods.licenseOwners(i).call));
      const isAllowed = yield call(ArbitrationLicenseInstance.methods.isAllowed(address, arbitrator).call);
      const isLicenseOwner = yield call(ArbitrationLicenseInstance.methods.isLicenseOwner(arbitrator).call);

      if(isLicenseOwner && (isAllowed || includeAll)) {
        const id = web3.utils.soliditySha3(arbitrator, address);
        arbitrators[arbitrator] = yield call(ArbitrationLicenseInstance.methods.arbitratorlicenseDetails(arbitrator).call);
        arbitrators[arbitrator].isAllowed = isAllowed;
        arbitrators[arbitrator].request = yield call(ArbitrationLicenseInstance.methods.requests(id).call);
      }
    }
    yield put({type: GET_ARBITRATORS_SUCCEEDED, arbitrators});
  } catch (error) {
    console.error(error);
    yield put({type: GET_ARBITRATORS_FAILED, error: error.message});
  }
}

export function *doGetEscrows({includeFallbackDisputes, isArbitrator}) {
  try {
    const filter = {};
    if(includeFallbackDisputes !== null && !includeFallbackDisputes && isArbitrator){
      filter.arbitrator = web3.eth.defaultAccount;
    }

    const events = yield EscrowInstance.getPastEvents('ArbitrationRequired', {filter, fromBlock: 1});

    let escrows = [];
    for (let i = 0; i < events.length; i++) {
      const escrowId = events[i].returnValues.escrowId;
      const block = yield web3.eth.getBlock(events[0].blockNumber);
      const escrow = yield call(EscrowInstance.methods.transactions(escrowId).call);
      const offer = yield OfferStoreInstance.methods.offers(escrow.offerId).call();

      escrow.escrowId = escrowId;
      escrow.seller = offer.owner;
      escrow.arbitration = yield call(EscrowInstance.methods.arbitrationCases(escrowId).call);
      escrow.arbitration.createDate = moment(block.timestamp * 1000).format("DD.MM.YY");

      if(escrow.arbitration.open || escrow.arbitration.result !== 0) {
        if(
          (includeFallbackDisputes && escrow.arbitration.arbitratorTimeout < (Date.now()/1000)) ||
          addressCompare(escrow.arbitrator, web3.eth.defaultAccount) ||
          (addressCompare(escrow.buyer, web3.eth.defaultAccount) || addressCompare(escrow.seller, web3.eth.defaultAccount))
          ){
          escrow.isFallback = includeFallbackDisputes && escrow.arbitration.arbitratorTimeout < (Date.now()/1000);
          escrows.push(escrow);
        }
      }
    }

    // remove duplicates in the case of re-opened disputes
    escrows = escrows.filter((obj, pos, arr) => {
      return arr.map(mapObj => mapObj['escrowId']).indexOf(obj['escrowId']) === pos;
    });

    yield put({type: GET_DISPUTED_ESCROWS_SUCCEEDED, escrows});
  } catch (error) {
    console.error(error);
    yield put({type: GET_DISPUTED_ESCROWS_FAILED, error: error.message});
  }
}

export function *onGetArbitrators() {
  yield takeEvery(GET_ARBITRATORS, doGetArbitrators);
}

export function *onGetEscrows() {
  yield takeEvery(GET_DISPUTED_ESCROWS, doGetEscrows);
}

export function *doLoadArbitration({escrowId}) {
  try {
    const escrow = yield call(EscrowInstance.methods.transactions(escrowId).call);
    const offer = yield OfferStoreInstance.methods.offers(escrow.offerId).call();

    const events = yield EscrowInstance.getPastEvents('Created', {fromBlock: 1, filter: {escrowId: escrowId} });
    const block = yield web3.eth.getBlock(events[0].blockNumber);
    escrow.createDate = moment(block.timestamp * 1000).format("DD.MM.YY");
    escrow.escrowId = escrowId;
    escrow.seller = offer.owner;
    escrow.offer = offer;
    escrow.arbitration = yield call(EscrowInstance.methods.arbitrationCases(escrowId).call);

    yield put({type: LOAD_ARBITRATION_SUCCEEDED, escrow});
  } catch (error) {
    console.error(error);
    yield put({type: LOAD_ARBITRATION_FAILED, error: error.message});
  }
}

export function *onLoadArbitration() {
  yield takeEvery(LOAD_ARBITRATION, doLoadArbitration);
}

export function *onGetArbitratorApprovalRequests() {
  yield takeEvery(GET_ARBITRATION_REQUESTS, doGetArbitratorApprovalRequests);
}

export function *doGetArbitratorApprovalRequests() {
  try {
    const events = yield ArbitrationLicenseInstance.getPastEvents('ArbitratorRequested', {fromBlock: 1, filter: {arbitrator: web3.eth.defaultAccount} });
    const requests = yield all(events.map(function *(event) {
      const request = event.returnValues;
      const requestDetail = yield ArbitrationLicenseInstance.methods.requests(request.id).call();

      if([NONE, CLOSED].indexOf(requestDetail.status) > -1 || !addressCompare(requestDetail.arbitrator, web3.eth.defaultAccount)) return null;

      request.status = requestDetail.status;
      return request;
    }));

    yield put({type: GET_ARBITRATION_REQUESTS_SUCCEEDED, requests: requests.filter(x => x !== null)});

  } catch (error) {
    console.error(error);
    yield put({type: GET_ARBITRATION_REQUESTS_FAILED, error: error.message});
  }
}

export function *onGetArbitratorBlacklist() {
  yield takeEvery(GET_BLACKLISTED_SELLERS, doGetArbitratorBlacklist);
}

export function *doGetArbitratorBlacklist() {
  try {
    const events = yield ArbitrationLicenseInstance.getPastEvents('BlacklistSeller', {fromBlock: 1, filter: {arbitrator: web3.eth.defaultAccount} });
    const sellers = yield all(events.map(function *(event) {
      const isBlacklisted = yield ArbitrationLicenseInstance.methods.blacklist(event.returnValues.seller).call();

      if (!isBlacklisted) {
        return null;
      }
      return event.returnValues.seller;
    }));

    yield put({type: GET_BLACKLISTED_SELLERS_SUCCEEDED, sellers: sellers.filter(x => x !== null)});

  } catch (error) {
    console.error(error);
    yield put({type: GET_BLACKLISTED_SELLERS_FAILED, error: error.message});
  }
}

export function *onIsFallbackArbitrator() {
  yield takeEvery(IS_FALLBACK_ARBITRATOR, doCheckFallbackArbitrator);
}


export function *doCheckFallbackArbitrator() {
  try {
    const fallbackArbitrator = yield call(EscrowInstance.methods.fallbackArbitrator().call);
    const code = yield call(web3.eth.getCode, fallbackArbitrator);
    let isFallbackArbitrator = false;
    if(code === '0x'){
      isFallbackArbitrator = addressCompare(fallbackArbitrator, web3.eth.defaultAccount);
    } else {
      isFallbackArbitrator = yield call(GnosisSafe.methods.isOwner(web3.eth.defaultAccount).call);
    }
    yield put({type: IS_FALLBACK_ARBITRATOR_SUCCEEDED, isFallbackArbitrator});
  } catch (error) {
    console.error(error);
    yield put({type: IS_FALLBACK_ARBITRATOR_FAILED, error: error.message});
  }
}

export function *onGetFallbackArbitrator() {
  yield takeEvery(GET_FALLBACK_ARBITRATOR, doGetFallbackArbitrator);
}

export function *doGetFallbackArbitrator() {
  try {
    const fallbackArbitrator = yield call(EscrowInstance.methods.fallbackArbitrator().call);
    yield put({type: GET_FALLBACK_ARBITRATOR_SUCCEEDED, fallbackArbitrator});

  } catch (error) {
    console.error(error);
    yield put({type: GET_FALLBACK_ARBITRATOR_FAILED, error: error.message});
  }
}


export function *doBuyLicense() {
  try {
    const price = yield call(ArbitrationLicenseInstance.methods.price().call);
    const encodedCall = ArbitrationLicenseInstance.methods.buy().encodeABI();
    const toSend = SNT.methods.approveAndCall(ArbitrationLicenseInstance.options.address, price, encodedCall);
    const estimatedGas = yield call(toSend.estimateGas);
    const promiseEvent = toSend.send({gasLimit: estimatedGas + 2000});
    const channel = eventChannel(promiseEventEmitter.bind(null, promiseEvent));
    while (true) {
      const {hash, receipt, error} = yield take(channel);
      if (hash) {
        yield put({type: BUY_LICENSE_PRE_SUCCESS, txHash: hash});
      } else if (receipt) {
        yield put({type: BUY_LICENSE_SUCCEEDED});
      } else if (error) {
        throw error;
      } else {
        break;
      }
    }
  } catch (error) {
    console.error(error);
    yield put({type: BUY_LICENSE_FAILED, error: error.message});
  }
}

export function *onBuyLicense() {
  yield takeEvery(BUY_LICENSE, doBuyLicense);
}

export function *loadPrice() {
  try {
    const price = yield call(ArbitrationLicenseInstance.methods.price().call);
    yield put({type: LOAD_PRICE_SUCCEEDED, price});
  } catch (error) {
    console.error(error);
    yield put({type: LOAD_PRICE_FAILED, error: error.message});
  }
}

export function *onLoadPrice() {
  yield takeEvery(LOAD_PRICE, loadPrice);
}

export function *doCheckLicenseOwner() {
  if(!web3.eth.defaultAccount) return;

  try {
    const isLicenseOwner = yield call(ArbitrationLicenseInstance.methods.isLicenseOwner(web3.eth.defaultAccount).call);
    const licenseDetails = yield call(ArbitrationLicenseInstance.methods.arbitratorlicenseDetails(web3.eth.defaultAccount).call);
    yield put({type: CHECK_LICENSE_OWNER_SUCCEEDED, isLicenseOwner, acceptAny: licenseDetails.acceptAny});
  } catch (error) {
    console.error(error);
    yield put({type: CHECK_LICENSE_OWNER_FAILED, error: error.message});
  }
}

export function *onCheckLicenseOwner() {
  yield takeEvery(CHECK_LICENSE_OWNER, doCheckLicenseOwner);
}

export function *onRequestArbitrator() {
  yield takeEvery(REQUEST_ARBITRATOR, doTransaction.bind(null, REQUEST_ARBITRATOR_PRE_SUCCESS, REQUEST_ARBITRATOR_SUCCEEDED, REQUEST_ARBITRATOR_FAILED));
}

export function *doCancelArbitratorRequest({arbitrator}){
  const id = web3.utils.soliditySha3(arbitrator, web3.eth.defaultAccount);
  const toSend = ArbitrationLicenseInstance.methods.cancelRequest(id);
  yield doTransaction(CANCEL_ARBITRATOR_REQUEST_PRE_SUCCESS, CANCEL_ARBITRATOR_REQUEST_SUCCEEDED, CANCEL_ARBITRATOR_REQUEST_FAILED, {
    arbitrator,
    toSend
  });
}

export function *onCancelArbitratorRequest() {
  yield takeEvery(CANCEL_ARBITRATOR_REQUEST, doCancelArbitratorRequest);
}

export function *onChangeAcceptAll() {
  yield takeEvery(CHANGE_ACCEPT_EVERYONE, doTransaction.bind(null, CHANGE_ACCEPT_EVERYONE_PRE_SUCCESS, CHANGE_ACCEPT_EVERYONE_SUCCEEDED, CHANGE_ACCEPT_EVERYONE_FAILED));
}

export function *onAcceptRequest() {
  yield takeEvery(ACCEPT_ARBITRATOR_REQUEST, doTransaction.bind(null, ACCEPT_ARBITRATOR_REQUEST_PRE_SUCCESS, ACCEPT_ARBITRATOR_REQUEST_SUCCEEDED, ACCEPT_ARBITRATOR_REQUEST_FAILED));
}

export function *onRejectRequest() {
  yield takeEvery(REJECT_ARBITRATOR_REQUEST, doTransaction.bind(null, REJECT_ARBITRATOR_REQUEST_PRE_SUCCESS, REJECT_ARBITRATOR_REQUEST_SUCCEEDED, REJECT_ARBITRATOR_REQUEST_FAILED));
}

export function *onBlacklistSeller() {
  yield takeEvery(BLACKLIST_SELLER, doTransaction.bind(null, BLACKLIST_SELLER_PRE_SUCCESS, BLACKLIST_SELLER_SUCCEEDED, BLACKLIST_SELLER_FAILED));
}

export function *onUnBlacklistSeller() {
  yield takeEvery(UNBLACKLIST_SELLER, doTransaction.bind(null, UNBLACKLIST_SELLER_PRE_SUCCESS, UNBLACKLIST_SELLER_SUCCEEDED, UNBLACKLIST_SELLER_FAILED));
}

export function *onLoadArbitratorScores(){
  yield takeEvery(LOAD_ARBITRATOR_SCORES, doLoadArbitratorScores);
}

export default [
  fork(onGetEscrows),
  fork(onResolveDispute),
  fork(onLoadArbitration),
  fork(onGetArbitrators),
  fork(onBuyLicense),
  fork(onCheckLicenseOwner),
  fork(onLoadPrice),
  fork(onOpenDispute),
  fork(onCancelDispute),
  fork(onRequestArbitrator),
  fork(onCancelArbitratorRequest),
  fork(onChangeAcceptAll),
  fork(onGetArbitratorApprovalRequests),
  fork(onAcceptRequest),
  fork(onBlacklistSeller),
  fork(onUnBlacklistSeller),
  fork(onRejectRequest),
  fork(onLoadArbitratorScores),
  fork(onGetFallbackArbitrator),
  fork(onIsFallbackArbitrator)
];
