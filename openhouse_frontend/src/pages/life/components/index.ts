/**
 * Life Game Components
 *
 * Exports all extracted UI components.
 */

export { EliminationModal } from './EliminationModal';
export { RegionSelectionModal } from './RegionSelectionModal';
export { GameHUD } from './GameHUD';
export type { GameHUDProps, SyncStatus, PendingTransactions } from './GameHUD';
export { Minimap } from './Minimap';
export type { MinimapProps } from './Minimap';
export { PatternLibrary } from './PatternLibrary';
export type { PatternLibraryProps } from './PatternLibrary';
export {
  GameStateWrapper,
  AnimatedModal,
  GamePhaseContainer,
  AnimatedButton,
  AnimatedGridItem,
  fadeSlideVariants,
  scaleVariants,
  modalVariants,
  backdropVariants,
  staggerContainerVariants,
  staggerItemVariants,
} from './GameStateTransition';
