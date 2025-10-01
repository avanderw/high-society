// Domain Layer - Card System

export enum PlayerColor {
  RED = 'red',
  BLUE = 'blue',
  GREEN = 'green',
  YELLOW = 'yellow',
  PURPLE = 'purple'
}

// Base Card Abstraction
export abstract class Card {
  constructor(
    public readonly id: string,
    public readonly name: string
  ) {}

  abstract getDisplayValue(): string;
}

// Status Card System
export abstract class StatusCard extends Card {
  constructor(
    id: string,
    name: string,
    public readonly isGameEndTrigger: boolean = false
  ) {
    super(id, name);
  }

  abstract applyEffect(player: any, context: any): StatusEffect[];
  abstract calculateStatusContribution(baseStatus: number): number;
}

// Status Effects (Command Pattern)
export abstract class StatusEffect {
  abstract apply(player: any, context: any): void;
}

export class AddStatusEffect extends StatusEffect {
  constructor(private value: number) {
    super();
  }

  apply(): void {
    // Applied during status calculation
  }

  getValue(): number {
    return this.value;
  }
}

export class MultiplyStatusEffect extends StatusEffect {
  constructor(private multiplier: number) {
    super();
  }

  apply(): void {
    // Applied during status calculation
  }

  getMultiplier(): number {
    return this.multiplier;
  }
}

export class HalveStatusEffect extends StatusEffect {
  apply(): void {
    // Applied during final status calculation
  }
}

export class DiscardLuxuryCardEffect extends StatusEffect {
  apply(player: any): void {
    player.setPendingLuxuryDiscard(true);
  }
}

export class RemoveCardEffect extends StatusEffect {
  constructor(private card: StatusCard) {
    super();
  }

  apply(player: any): void {
    player.removeStatusCard(this.card.id);
  }
}

// Concrete Status Card Types
export class LuxuryCard extends StatusCard {
  constructor(
    id: string,
    name: string,
    public readonly value: number
  ) {
    super(id, name, false);
  }

  applyEffect(): StatusEffect[] {
    return [new AddStatusEffect(this.value)];
  }

  calculateStatusContribution(): number {
    return this.value;
  }

  getDisplayValue(): string {
    return `${this.value}`;
  }
}

export class PrestigeCard extends StatusCard {
  constructor(id: string, name: string) {
    super(id, name, true);
  }

  applyEffect(): StatusEffect[] {
    return [new MultiplyStatusEffect(2)];
  }

  calculateStatusContribution(baseStatus: number): number {
    return baseStatus;
  }

  getDisplayValue(): string {
    return '×2';
  }
}

export class DisgraceFauxPas extends StatusCard {
  constructor() {
    super('faux-pas', 'Faux Pas', false);
  }

  applyEffect(player: any, context: any): StatusEffect[] {
    return [new DiscardLuxuryCardEffect(), new RemoveCardEffect(this)];
  }

  calculateStatusContribution(): number {
    return 0;
  }

  getDisplayValue(): string {
    return 'Discard Luxury';
  }
}

export class DisgracePassé extends StatusCard {
  constructor() {
    super('passe', 'Passé', false);
  }

  applyEffect(): StatusEffect[] {
    return [];
  }

  calculateStatusContribution(): number {
    return -5;
  }

  getDisplayValue(): string {
    return '-5';
  }
}

export class DisgraceScandale extends StatusCard {
  constructor() {
    super('scandale', 'Scandale', true);
  }

  applyEffect(): StatusEffect[] {
    return [new HalveStatusEffect()];
  }

  calculateStatusContribution(): number {
    return 0;
  }

  getDisplayValue(): string {
    return '÷2';
  }
}

// Money Card System
export class MoneyCard extends Card {
  constructor(
    id: string,
    public readonly value: number,
    public readonly playerColor: PlayerColor
  ) {
    super(id, `${value} Francs`);
  }

  getDisplayValue(): string {
    return `${(this.value / 1000).toFixed(0)}K`;
  }
}

// Card Definitions
export const LUXURY_CARDS: LuxuryCard[] = [
  new LuxuryCard('luxury-1', 'Fashion', 1),
  new LuxuryCard('luxury-2', 'Jewelry', 2),
  new LuxuryCard('luxury-3', 'Haute Cuisine', 3),
  new LuxuryCard('luxury-4', 'Travel', 4),
  new LuxuryCard('luxury-5', 'Art', 5),
  new LuxuryCard('luxury-6', 'Automobiles', 6),
  new LuxuryCard('luxury-7', 'Estate', 7),
  new LuxuryCard('luxury-8', 'Yacht', 8),
  new LuxuryCard('luxury-9', 'Dressage', 9),
  new LuxuryCard('luxury-10', 'Opera', 10)
];

export const PRESTIGE_CARDS: PrestigeCard[] = [
  new PrestigeCard('prestige-1', 'Bon Vivant'),
  new PrestigeCard('prestige-2', 'Joie De Vivre'),
  new PrestigeCard('prestige-3', 'Savoir Faire')
];

export const DISGRACE_CARDS: StatusCard[] = [
  new DisgraceFauxPas(),
  new DisgracePassé(),
  new DisgraceScandale()
];

export const MONEY_CARD_VALUES = [
  1000, 2000, 3000, 4000, 6000, 8000, 10000, 12000, 15000, 20000, 25000
];
