// Application Layer - Scoring System
import { StatusCard, LuxuryCard, PrestigeCard, DisgraceScandale } from './cards';
import type { Player } from './player';

export class StatusCalculator {
  calculate(statusCards: StatusCard[]): number {
    // Phase 1: Base status calculation
    let baseStatus = this.calculateBaseStatus(statusCards);

    // Phase 2: Apply multipliers (prestige cards)
    const multiplier = this.calculateMultiplier(statusCards);
    let finalStatus = baseStatus * multiplier;

    // Phase 3: Apply final modifiers (scandale halving)
    finalStatus = this.applyFinalModifiers(finalStatus, statusCards);

    return Math.max(0, Math.floor(finalStatus));
  }

  private calculateBaseStatus(cards: StatusCard[]): number {
    return cards.reduce((total, card) => {
      return total + card.calculateStatusContribution(0);
    }, 0);
  }

  private calculateMultiplier(cards: StatusCard[]): number {
    const prestigeCards = cards.filter(card => card instanceof PrestigeCard);
    return Math.pow(2, prestigeCards.length);
  }

  private applyFinalModifiers(status: number, cards: StatusCard[]): number {
    const hasScandaleCard = cards.some(card => card instanceof DisgraceScandale);
    return hasScandaleCard ? status / 2 : status;
  }
}

export interface PlayerRanking {
  player: Player;
  finalStatus: number;
  remainingMoney: number;
  highestLuxuryCard: number;
  rank?: number;
  isCastOut?: boolean;
}

export class GameScoringService {
  private statusCalculator = new StatusCalculator();

  calculateFinalRankings(players: Player[]): PlayerRanking[] {
    // Step 1: Cast out poorest players
    const eligiblePlayers = this.castOutPoorestPlayers(players);
    const castOutPlayers = players.filter(p => !eligiblePlayers.includes(p));

    // Step 2: Calculate final status for eligible players
    const rankings = eligiblePlayers.map(player => ({
      player,
      finalStatus: this.statusCalculator.calculate(player.getStatusCards()),
      remainingMoney: player.getTotalRemainingMoney(),
      highestLuxuryCard: this.getHighestLuxuryCardValue(player),
      isCastOut: false
    }));

    // Add cast out players
    const castOutRankings = castOutPlayers.map(player => ({
      player,
      finalStatus: 0,
      remainingMoney: player.getTotalRemainingMoney(),
      highestLuxuryCard: 0,
      isCastOut: true
    }));

    // Step 3: Sort by game rules with tie-breakers
    const sortedRankings = this.sortByGameRules(rankings);
    
    // Assign ranks
    sortedRankings.forEach((ranking, index) => {
      ranking.rank = index + 1;
    });

    const castOutWithRanks: PlayerRanking[] = castOutRankings.map((ranking, index) => ({
      ...ranking,
      rank: sortedRankings.length + 1 + index
    }));

    return [...sortedRankings, ...castOutWithRanks];
  }

  private castOutPoorestPlayers(players: Player[]): Player[] {
    if (players.length === 0) return [];
    if (players.length === 1) return players; // Can't cast out the only player
    const minMoney = Math.min(...players.map(p => p.getTotalRemainingMoney()));
    const eligible = players.filter(player => player.getTotalRemainingMoney() > minMoney);
    // If everyone has the same money (tie for poorest), keep all players
    return eligible.length === 0 ? players : eligible;
  }

  private sortByGameRules(rankings: PlayerRanking[]): PlayerRanking[] {
    return rankings.sort((a, b) => {
      // Primary: Highest status
      if (a.finalStatus !== b.finalStatus) {
        return b.finalStatus - a.finalStatus;
      }

      // Secondary: Most money left
      if (a.remainingMoney !== b.remainingMoney) {
        return b.remainingMoney - a.remainingMoney;
      }

      // Tertiary: Highest luxury card
      return b.highestLuxuryCard - a.highestLuxuryCard;
    });
  }

  private getHighestLuxuryCardValue(player: Player): number {
    const luxuryCards = player.getLuxuryCards();
    return luxuryCards.length > 0
      ? Math.max(...luxuryCards.map(card => card.value))
      : 0;
  }
}
