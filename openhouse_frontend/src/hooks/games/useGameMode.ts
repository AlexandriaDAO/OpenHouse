import { useAuth } from '../../providers/AuthProvider';
import { GameMode } from '../../components/game-ui';

export const useGameMode = () => {
  const { isAuthenticated } = useAuth();

  // Mode is always derived from authentication state
  const mode: GameMode = isAuthenticated ? 'real' : 'practice';
  const isPracticeMode = !isAuthenticated;

  return {
    mode,
    isPracticeMode,
    isAuthenticated,
  };
};