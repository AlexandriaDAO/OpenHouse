import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useBettingState } from './hooks/useBettingState';
import { useDepositFlow } from './hooks/useDepositFlow';
import { ChipStack } from './ChipStack';
import { ChipSpeedDial } from './ChipSpeedDial';
import { DepositModal } from './DepositModal';
import { RAIL_STYLES } from './types';
import { formatUSDT } from '../../types/balance';
import './betting.css';

export type { BettingRailProps, RailStyle } from './types';
export { RAIL_STYLES } from './types';

// Loading skeleton for balance values
const BalanceSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <motion.span
    className={`inline-block bg-gray-700 rounded ${className}`}
    animate={{ opacity: [0.5, 1, 0.5] }}
    transition={{ duration: 1.5, repeat: Infinity }}
  >
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  </motion.span>
);

export function BettingRail(props: any) {
  const navigate = useNavigate();
  const isBalanceLoading = props.isBalanceLoading ?? false;

  const betting = useBettingState(props);
  const deposit = useDepositFlow(props);

  // Cash out confirmation modal
  const [showCashOutModal, setShowCashOutModal] = useState(false);

  const {
    betAmount,
    gameBalanceUSDT,
    maxBet,
    disabled,
    canAddChip,
    addChip,
    removeChip,
    clearBet,
    setMaxBet,
    railStyle,
    setRailStyle,
    showStylePicker,
    setShowStylePicker,
    gameBalance,
    houseBalance,
    onBalanceRefresh,
    showDepositAnimation,
  } = betting;


  const atMax = betAmount >= maxBet || betAmount >= gameBalanceUSDT;

  // Handle cash out with confirmation
  const handleCashOutClick = () => {
    if (gameBalance > 0n) {
      setShowCashOutModal(true);
    }
  };

  const confirmCashOut = async () => {
    setShowCashOutModal(false);
    await deposit.handleWithdrawAll();
  };

  // Cash Out Confirmation Modal
  const CashOutModal = () => (
    <div className="modal-overlay" onClick={() => setShowCashOutModal(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>Cash Out</h3>
        <p>Withdraw all {formatUSDT(gameBalance)} chips to your wallet?</p>
        <div className="modal-buttons">
          <button onClick={() => setShowCashOutModal(false)} className="modal-btn modal-btn--cancel">
            Cancel
          </button>
          <button onClick={confirmCashOut} className="modal-btn modal-btn--confirm">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* DESKTOP LAYOUT */}
      <div className="hidden md:block fixed bottom-0 left-0 right-0 z-40">
        <div className="betting-rail-desktop rail-theme--neon">
          <div className="rail-desktop-content-slim">

            {/* LEFT: Balances (tappable like mobile) */}
            <div className="rail-left-slim">
              <div className="desktop-balance-row">
                <button
                  onClick={deposit.openModal}
                  className={`desktop-balance-btn ${showDepositAnimation ? 'deposit-pulse' : ''}`}
                  title="Deposit / Withdraw"
                >
                  <span className="desktop-balance-icon desktop-balance-icon--plusminus">+/-</span>
                  <span className="desktop-balance-label">CHIPS</span>
                  {isBalanceLoading ? (
                    <BalanceSkeleton className="h-4 w-16" />
                  ) : (
                    <motion.span
                      className="desktop-balance-value text-highlight"
                      key={gameBalance.toString()}
                      initial={{ scale: 1.1, opacity: 0.7 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      {formatUSDT(gameBalance)}
                    </motion.span>
                  )}
                </button>
                <button onClick={onBalanceRefresh} className="desktop-refresh-btn" title="Refresh Balances">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M4 12c0-4.4 3.6-8 8-8 3.1 0 5.8 1.8 7.1 4.4M20 12c0 4.4-3.6 8-8 8-3.1 0-5.8-1.8-7.1-4.4"/>
                    <path d="M20 4v4h-4M4 20v-4h4"/>
                  </svg>
                </button>
              </div>
              <button
                onClick={() => navigate('/liquidity')}
                className="desktop-balance-btn"
                title="Be The House"
              >
                <span className="desktop-balance-icon desktop-balance-icon--house">⌂</span>
                <span className="desktop-balance-label">HOUSE</span>
                {isBalanceLoading ? (
                  <BalanceSkeleton className="h-4 w-16" />
                ) : (
                  <motion.span
                    className="desktop-balance-value"
                    key={houseBalance.toString()}
                    initial={{ scale: 1.1, opacity: 0.7 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {formatUSDT(houseBalance)}
                  </motion.span>
                )}
              </button>
            </div>

            {/* CENTER: Pot with CLR/MAX controls */}
            <div className="rail-center-slim">
              <div className="desktop-pot-controls">
                <button
                  onClick={clearBet}
                  disabled={disabled || betAmount === 0}
                  className="desktop-pot-btn desktop-pot-btn--clr"
                >
                  CLR
                </button>
                <div className="desktop-pot-stack">
                  <ChipStack
                    amount={betAmount}
                    onRemoveChip={removeChip}
                    disabled={disabled}
                    maxChipsPerPile={8}
                  />
                  <span className="desktop-pot-amount">${betAmount.toFixed(2)}</span>
                </div>
                <button
                  onClick={setMaxBet}
                  disabled={disabled || atMax}
                  className="desktop-pot-btn desktop-pot-btn--max"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* RIGHT: Chip Speed Dial (expands up) */}
            <div className="rail-right-slim">
              <ChipSpeedDial
                onAddChip={addChip}
                canAddChip={canAddChip}
                disabled={disabled}
                expandDirection="up"
                size="md"
              />
            </div>

          </div>
        </div>
      </div>

      {/* MOBILE LAYOUT */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        {/* Mobile rail with curved top border */}
        <div className={`betting-rail-mobile rail-theme--${railStyle}`}>

          <div className="mobile-rail-grid">
            {/* 3-column layout: balances | pot | chips */}
            <div className="mobile-three-col">
              {/* LEFT: Balances with bet controls in first row */}
              <div className="mobile-col-balances">
                <div className="mobile-bet-row">
                  <button onClick={onBalanceRefresh} className="mobile-sync-icon" title="Refresh">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M4 12c0-4.4 3.6-8 8-8 3.1 0 5.8 1.8 7.1 4.4M20 12c0 4.4-3.6 8-8 8-3.1 0-5.8-1.8-7.1-4.4"/>
                      <path d="M20 4v4h-4M4 20v-4h4"/>
                    </svg>
                  </button>
                  <button
                    onClick={clearBet}
                    disabled={disabled || betAmount === 0}
                    className="mobile-bet-ctrl mobile-bet-ctrl--clr"
                  >
                    CLR
                  </button>
                  <span className="mobile-bet-value">${betAmount.toFixed(2)}</span>
                  <button
                    onClick={setMaxBet}
                    disabled={disabled || atMax}
                    className="mobile-bet-ctrl mobile-bet-ctrl--max"
                  >
                    MAX
                  </button>
                </div>
                <button
                  onClick={deposit.openModal}
                  className={`balance-row-btn balance-row-btn--chips ${showDepositAnimation ? 'deposit-pulse' : ''}`}
                  title="Deposit / Withdraw"
                >
                  <span className="balance-icon balance-icon--plusminus">+/-</span>
                  <span className="balance-label">CHIPS</span>
                  {isBalanceLoading ? (
                    <BalanceSkeleton className="h-3 w-12" />
                  ) : (
                    <motion.span
                      className="balance-value text-highlight"
                      key={gameBalance.toString()}
                      initial={{ scale: 1.1, opacity: 0.7 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      {formatUSDT(gameBalance)}
                    </motion.span>
                  )}
                </button>
                <button
                  onClick={() => navigate('/liquidity')}
                  className="balance-row-btn balance-row-btn--house"
                  title="Be The House"
                >
                  <span className="balance-icon balance-icon--house">⌂</span>
                  <span className="balance-label">HOUSE</span>
                  {isBalanceLoading ? (
                    <BalanceSkeleton className="h-3 w-12" />
                  ) : (
                    <motion.span
                      className="balance-value"
                      key={houseBalance.toString()}
                      initial={{ scale: 1.1, opacity: 0.7 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      {formatUSDT(houseBalance)}
                    </motion.span>
                  )}
                </button>
              </div>

              {/* CENTER: Chip pile */}
              <div className="mobile-col-pot">
                <ChipStack
                  amount={betAmount}
                  onRemoveChip={removeChip}
                  disabled={disabled}
                  layout="circular"
                  circleSize={100}
                  showBetControls={false}
                />
              </div>

              {/* RIGHT: Chip Speed Dial */}
              <div className="mobile-col-chips flex items-center justify-center">
                <ChipSpeedDial
                  onAddChip={addChip}
                  canAddChip={canAddChip}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {deposit.showModal && <DepositModal deposit={deposit} />}
      {showCashOutModal && <CashOutModal />}
    </>
  );
}
