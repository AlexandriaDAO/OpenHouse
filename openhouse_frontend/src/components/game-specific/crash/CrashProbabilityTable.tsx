import React, { useEffect, useState } from 'react';
import useCrashActor from '../../../hooks/actors/useCrashActor';

export const CrashProbabilityTable: React.FC = () => {
  const { actor } = useCrashActor();
  const [probabilities, setProbabilities] = useState<Array<[number, number]>>([]);
  const [formula, setFormula] = useState<string>('');
  const [expectedValue, setExpectedValue] = useState<number>(0);

  useEffect(() => {
    if (!actor) return;

    // Fetch probability table from backend
    actor.get_probability_table().then(setProbabilities).catch(console.error);

    // Fetch formula
    actor.get_crash_formula().then(setFormula).catch(console.error);

    // Fetch expected value
    actor.get_expected_value().then(setExpectedValue).catch(console.error);
  }, [actor]);

  return (
    <div className="card">
      <h3 className="font-bold mb-4 text-center text-dfinity-turquoise">
        Transparent Odds
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pure-white/20">
              <th className="text-left py-2 px-2">Target</th>
              <th className="text-left py-2 px-2">Win Chance</th>
              <th className="text-left py-2 px-2">Expected Return</th>
            </tr>
          </thead>
          <tbody>
            {probabilities.map(([target, prob]) => (
              <tr key={target} className="border-b border-pure-white/10">
                <td className="py-2 px-2 font-mono">{target.toFixed(2)}x</td>
                <td className="py-2 px-2">
                  <span className="text-dfinity-turquoise">
                    {(prob * 100).toFixed(2)}%
                  </span>
                </td>
                <td className="py-2 px-2">
                  <span className="text-pure-white/60">
                    {(prob * target).toFixed(4)}x
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Formula display */}
      <div className="mt-4 p-3 bg-pure-white/5 rounded">
        <div className="text-xs text-pure-white/60 mb-1">Formula:</div>
        <code className="text-sm font-mono text-dfinity-turquoise">
          {formula || 'crash = 0.99 / (1.0 - random)'}
        </code>
        <div className="text-xs text-pure-white/60 mt-2">
          Expected Value: {expectedValue.toFixed(2)} (exactly 1% house edge)
        </div>
      </div>
    </div>
  );
};
