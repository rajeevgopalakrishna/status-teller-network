import React, {Component, Fragment} from 'react';
import PropTypes from 'prop-types';
import {connect} from "react-redux";
import {withRouter} from "react-router-dom";

import { States } from '../../../utils/transaction';
import newBuy from "../../../features/newBuy";
import escrow from '../../../features/escrow';
import prices from '../../../features/prices';
import metadata from '../../../features/metadata';
import network from '../../../features/network';
import Loading from '../../../components/Loading';
import ErrorInformation from '../../../components/ErrorInformation';
import OfferTrade from './components/OfferTrade';

const MIN = 200;
const MAX = 600;

class Trade extends Component {
  constructor(props) {
    super(props);
    this.state = {
      currencyQuantity: props.currencyQuantity,
      assetQuantity: props.assetQuantity,
      disabled: true,
      ready: false
    };

    props.footer.hide();

    props.footer.onPageChange(() => {
      props.setTrade(this.state.currencyQuantity, this.state.assetQuantity);
    });
  }

  componentDidMount() {
    if (isNaN(this.props.offerId)) {
      return this.props.history.push('/');
    }
    this.props.loadOffers();
    this.setState({ready: true});
  }

  componentDidUpdate() {
    if (this.props.createEscrowStatus === States.success) {
      this.props.resetCreateEscrowStatus();
      return this.props.history.push('/escrow/' + this.props.escrowId);
    }
  }

  validate(currencyQuantity, assetQuantity) {
    if (currencyQuantity < 0 || assetQuantity < 0 || currencyQuantity < MIN || currencyQuantity > MAX) {
      this.setState({disabled: true});
      return;
    }
    this.setState({disabled: false});
  }

  postEscrow = () => {
    this.props.createEscrow(this.props.address, this.props.username, this.state.assetQuantity, this.props.statusContactCode, this.props.offer);
  };

  onAssetChange = (assetQuantity) => {
    let currencyQuantity = 0;
    if(assetQuantity !== ""){ 
      assetQuantity = parseFloat(assetQuantity);
      currencyQuantity = assetQuantity * this.props.price;
      this.validate(currencyQuantity, assetQuantity);
      if (isNaN(currencyQuantity)) {
        return;
      }
    }
    this.setState({assetQuantity, currencyQuantity});
  };

  onCurrencyChange = (currencyQuantity) => {
    let assetQuantity = 0;
    if(currencyQuantity !== ""){ 
      currencyQuantity = parseFloat(currencyQuantity);
      assetQuantity = currencyQuantity / this.props.price;
      this.validate(currencyQuantity, assetQuantity);
      if (isNaN(assetQuantity)) {
        return;
      }
    }
    this.setState({currencyQuantity, assetQuantity});
  };

  render() {
    if (!this.state.ready || !this.props.offer) {
      return <Loading page/>;
    }

    switch(this.props.createEscrowStatus){
      case States.pending:
        return <Loading mining/>;
      case States.failed:
        return <ErrorInformation transaction retry={this.postEscrow}/>;
      case States.none:
        return (
          <OfferTrade address={this.props.offer.owner}
                      name={this.props.offer.user.username}
                      minFIAT={200}
                      maxFIAT={600}
                      price={this.props.price}
                      asset={this.props.offer.token.symbol}
                      currency={{id: this.props.offer.currency}}
                      onClick={this.postEscrow}
                      currencyQuantity={this.state.currencyQuantity}
                      assetQuantity={this.state.assetQuantity}
                      onAssetChange={this.onAssetChange}
                      onCurrencyChange={this.onCurrencyChange}
                      disabled={this.state.disabled}/>
        );
      default:
        return <Fragment/>;
    }
  }
}

Trade.propTypes = {
  history: PropTypes.object,
  setTrade: PropTypes.func,
  resetCreateEscrowStatus: PropTypes.func,
  offer: PropTypes.object,
  address: PropTypes.string,
  currencyQuantity: PropTypes.number,
  assetQuantity: PropTypes.number,
  footer: PropTypes.object,
  statusContactCode: PropTypes.string,
  username: PropTypes.string,
  loadOffers: PropTypes.func,
  offerId: PropTypes.number,
  createEscrow: PropTypes.func,
  createEscrowStatus: PropTypes.string,
  escrowId: PropTypes.string,
  price: PropTypes.number
};

const mapStateToProps = (state) => {
  const offerId = newBuy.selectors.offerId(state);
  const offer = metadata.selectors.getOfferById(state, offerId);
  const priceData = prices.selectors.getPrices(state);
  const price = priceData[offer.token.symbol][offer.currency];

  return {
    createEscrowStatus: escrow.selectors.getCreateEscrowStatus(state),
    escrowId: escrow.selectors.getCreateEscrowId(state),
    statusContactCode: newBuy.selectors.statusContactCode(state),
    username: newBuy.selectors.username(state),
    currencyQuantity: newBuy.selectors.currencyQuantity(state),
    assetQuantity: newBuy.selectors.assetQuantity(state),
    address: network.selectors.getAddress(state),
    offer,
    offerId,
    price
  };
};

export default connect(
  mapStateToProps,
  {
    setTrade: newBuy.actions.setTrade,
    resetCreateEscrowStatus: escrow.actions.resetCreateEscrowStatus,
    createEscrow: escrow.actions.createEscrow,
    loadOffers: metadata.actions.loadOffers
  }
)(withRouter(Trade));
