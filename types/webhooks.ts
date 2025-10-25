export interface PirepData {
  id: string;
  pilotName: string;
  pilotCallsign: string;
  aircraft: string;
  departure: string;
  arrival: string;
  flightNumber: string;
  flightTime: number;
  fuel?: number;
  cargo?: number;
  submittedAt: Date;
  remarks?: string;
}

export interface LeaveRequestData {
  id: string;
  pilotName: string;
  pilotCallsign: string;
  reason: string;
  startDate: Date;
  endDate: Date;
  submittedAt: Date;
}

export interface ApplicationData {
  email: string;
  name: string;
  callsign?: number;
  submittedAt: Date;
}

export interface RankupData {
  userId: string;
  pilotName: string;
  pilotCallsign: string;
  previousRank: string | null;
  newRank: string;
  totalFlightTime: number;
  achievedAt: Date;
}

export interface WebhookOptions {
  airlineName: string;
  airlineCallsign: string;
}
