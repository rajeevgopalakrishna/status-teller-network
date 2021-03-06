import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Row, Card, CardHeader, CardBody, Button} from 'reactstrap';
import { Link } from "react-router-dom";
import { withTranslation } from 'react-i18next';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import ConfirmDialog from "../../../components/ConfirmDialog";
import {CURRENCY_DATA} from "../../../constants/currencies";
import classnames from 'classnames';
import iconDelete from '../../../../images/delete.svg';
import { addressCompare, zeroAddress } from '../../../utils/address';

class Offers extends Component {
  state = {
    displayDialog: false,
    offerId: null
  };

  confirmDelete = offerId => (e) => {
    if(e) e.preventDefault();
    this.setState({ offerId, displayDialog: true });
    return false;
  };

  displayDialog = show => () => {
    this.setState({displayDialog: show});
    return false;
  };


  deleteOffer = () => {
    this.props.deleteOffer(this.state.offerId);
    this.setState({offerId: null, displayDialog: false});
  };

  renderOffers(offers, enabled) {
    const {t} = this.props;
    return offers.map((offer, index) => (
      <Card key={index} className={classnames('mb-2', 'shadow-sm', {'card-transparent': !enabled})}>
        <CardHeader className="bg-transparent border-bottom-0">
          {offer.token.symbol}
          <FontAwesomeIcon icon={faArrowRight} className="mx-4"/>
          <span className="text-small font-italic mr-2">{CURRENCY_DATA.find(x => x.id === offer.currency).symbol}</span>
          {offer.currency}
          { enabled && (
            <Button className="p-0 pl-3 pr-3 m-0 float-right" color="link" onClick={this.confirmDelete(offer.id)}>
              <img src={iconDelete} alt="Delete icon" />
            </Button>
          )}
        </CardHeader>
        <CardBody>
          <Row>
            <dl className="col-6">
              <dt>{t('offers.type')}</dt>
              <dd>{t('offers.typeSell')}</dd>
            </dl>
            <dl className="col-6">
              <dt>{t('offers.paymentMethods')}</dt>
              <dd>{offer.paymentMethodsForHuman}</dd>
            </dl>
          </Row>
          <Row>
            <dl className="col-6">
              <dt>{t('offers.location')}</dt>
              <dd>{this.props.location}</dd>
            </dl>
            <dl className="col-6">
              <dt>{t('offers.rate')}</dt>
              <dd>{offer.rateForHuman}</dd>
            </dl>
          </Row>
          <Row>
            <dl className="col-12">
              <dt>Arbitrator</dt>
              <dd>{offer.arbitratorData ? (offer.arbitratorData.username || t('offers.noUsername')) : t('offers.noArbitrator')} ({offer.arbitrator})</dd>
            </dl>
          </Row>
        </CardBody>
      </Card>
    ));
  }

  renderEmpty() {
    const {t} = this.props;
    return (
      <Card body className="text-center">
        {t('offers.noOpen')}
      </Card>
    );
  }

  render() {
    const {t, offers} = this.props;
    const activeOffers = offers.filter(x => !x.deleted && !addressCompare(x.arbitrator, zeroAddress));
    const inactiveOffers = offers.filter(x => x.deleted || addressCompare(x.arbitrator, zeroAddress));

    return (
      <div className="mt-3">
        <div>
          <h3 className="d-inline-block">{t('offers.active')}</h3>
          <span className="float-right">
            <Link to="/sell" className="float-right text-small">{t('offers.create')}</Link>
          </span>
        </div>
        {activeOffers.length === 0 ? this.renderEmpty() : this.renderOffers(activeOffers, true)}
        <div className="mt-5">
          <h3 className="d-inline-block">{t('offers.past')}</h3>
        </div>
        {inactiveOffers.length === 0 ? this.renderEmpty() : this.renderOffers(inactiveOffers, false)}
        <ConfirmDialog display={this.state.displayDialog} onConfirm={this.deleteOffer}
                       onCancel={this.displayDialog(false)} title={t('offers.deleteOffer')}
                       content={t('general.youSure')}
                       cancelText={t('general.no')}/>
      </div>
    );
  }
}

Offers.propTypes = {
  t: PropTypes.func,
  location: PropTypes.string,
  offers: PropTypes.array,
  deleteOffer: PropTypes.func
};

export default withTranslation()(Offers);
