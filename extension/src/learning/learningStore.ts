import type * as vscode from 'vscode';
import { emptyState, addEvent, setOutcome, summarize } from './progress';
import type { LearningEvent, LearningState, Outcome, Progress } from './types';

const KEY = 'uncode.learning.v1';

/** Persists learning state in the extension's global Memento. Pure logic lives in progress.ts. */
export class LearningStore {
  constructor(private readonly memento: vscode.Memento) {}

  private load(): LearningState {
    return this.memento.get<LearningState>(KEY) ?? emptyState();
  }

  private save(state: LearningState): Thenable<void> {
    return this.memento.update(KEY, state);
  }

  async addReview(event: LearningEvent): Promise<LearningEvent> {
    await this.save(addEvent(this.load(), event));
    return event;
  }

  async setOutcome(
    id: string,
    outcome: Outcome,
    concept?: string,
    conceptLabel?: string,
  ): Promise<LearningEvent | undefined> {
    const next = setOutcome(this.load(), id, outcome, concept, conceptLabel);
    await this.save(next);
    return next.events.find((e) => e.id === id);
  }

  progress(): Progress {
    return summarize(this.load(), new Date().toISOString().slice(0, 10));
  }
}
