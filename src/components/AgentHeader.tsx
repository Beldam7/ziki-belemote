import { useEffect, useState } from 'react';
import { LEVEL_HELP } from '../status';
import type { Agent } from '../types';
import { Avatar, ConfirmPanel, Icon, Pill } from './ui';

interface Props {
  agent: Agent;
  /** Requests from this agent that are waiting for the owner. */
  waiting: number;
  onPause: () => void;
  onResume: () => void;
}

/** Who the agent is, whether it is paused, and the pause / resume control. */
export function AgentHeader({ agent, waiting, onPause, onResume }: Props) {
  const [confirming, setConfirming] = useState(false);

  // Start fresh whenever the agent changes or its state flips.
  useEffect(() => setConfirming(false), [agent.id, agent.paused]);

  return (
    <section className={`panel agent-head${agent.paused ? ' is-paused' : ''}`} aria-label={`${agent.name} at a glance`}>
      <Avatar id={agent.id} name={agent.name} size="lg" />
      <div className="agent-head-text">
        <p className="agent-head-name">
          {agent.name} <span className="role">{agent.level}</span>
          {agent.paused && (
            <Pill tone="neutral">
              <Icon name="pause" size={12} /> Paused
            </Pill>
          )}
        </p>
        <p className="muted small">
          {LEVEL_HELP[agent.level]}{' '}
          {agent.paused ? "Paused: it won't start anything new until you resume it." : 'It acts within its Brief.'}
        </p>
      </div>

      {agent.paused ? (
        <button className="primary" onClick={onResume}>
          <Icon name="play" size={16} /> Resume
        </button>
      ) : (
        !confirming && (
          <button onClick={() => (waiting > 0 ? setConfirming(true) : onPause())}>
            <Icon name="pause" size={16} /> Pause
          </button>
        )
      )}

      {confirming && (
        <ConfirmPanel
          title={`Pause ${agent.name}?`}
          confirmLabel="Pause anyway"
          cancelLabel="Keep it active"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onPause();
          }}
        >
          {waiting === 1 ? '1 request is' : `${waiting} requests are`} still waiting for you. They stay in Approvals and you can still
          answer them. {agent.name} just won't start anything new until you resume it.
        </ConfirmPanel>
      )}
    </section>
  );
}
