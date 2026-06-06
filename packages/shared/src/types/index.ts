// ─── Enums ────────────────────────────────────────────────────────────────────

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum UserRole {
  PLAYER = 'PLAYER',
  PITCH_OWNER = 'PITCH_OWNER',
  ADMIN = 'ADMIN',
}

export enum SkillLevel {
  BEGINNER = 'BEGINNER',
  AMATEUR = 'AMATEUR',
  PRO = 'PRO',
}

export enum Sport {
  FOOTBALL = 'FOOTBALL',
  PADEL = 'PADEL',
  TENNIS = 'TENNIS',
}

export enum MatchStatus {
  OPEN = 'OPEN',
  FULL = 'FULL',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum MatchPosition {
  GK = 'GK',
  LB = 'LB',
  CB = 'CB',
  CB2 = 'CB2',
  RB = 'RB',
  LWB = 'LWB',
  RWB = 'RWB',
  CDM = 'CDM',
  CM = 'CM',
  CM2 = 'CM2',
  CAM = 'CAM',
  LW = 'LW',
  RW = 'RW',
  CF = 'CF',
  ST = 'ST',
}

export enum TeamSide {
  HOME = 'HOME',
  AWAY = 'AWAY',
}

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentGateway {
  PAYME = 'PAYME',
  CLICK = 'CLICK',
  UZUM = 'UZUM',
  CASH = 'CASH',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum NotificationType {
  MATCH_INVITE = 'MATCH_INVITE',
  MATCH_FULL = 'MATCH_FULL',
  MATCH_REMINDER = 'MATCH_REMINDER',
  MATCH_CANCELLED = 'MATCH_CANCELLED',
  MATCH_COMPLETED = 'MATCH_COMPLETED',
  BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  RATING_RECEIVED = 'RATING_RECEIVED',
  NEW_MESSAGE = 'NEW_MESSAGE',
  SYSTEM = 'SYSTEM',
}

export enum AmenityType {
  PARKING = 'PARKING',
  SHOWERS = 'SHOWERS',
  LOCKERS = 'LOCKERS',
  CAFE = 'CAFE',
  LIGHTING = 'LIGHTING',
  TRIBUNES = 'TRIBUNES',
  FIRST_AID = 'FIRST_AID',
  EQUIPMENT_RENTAL = 'EQUIPMENT_RENTAL',
  WIFI = 'WIFI',
  CCTV = 'CCTV',
}

export enum SurfaceType {
  NATURAL_GRASS = 'NATURAL_GRASS',
  ARTIFICIAL_TURF = 'ARTIFICIAL_TURF',
  FUTSAL_FLOOR = 'FUTSAL_FLOOR',
  CONCRETE = 'CONCRETE',
  SAND = 'SAND',
  HARDCOURT = 'HARDCOURT',
}

export enum PitchSize {
  FIVE_A_SIDE = 'FIVE_A_SIDE',
  SIX_A_SIDE = 'SIX_A_SIDE',
  SEVEN_A_SIDE = 'SEVEN_A_SIDE',
  EIGHT_A_SIDE = 'EIGHT_A_SIDE',
  NINE_A_SIDE = 'NINE_A_SIDE',
  ELEVEN_A_SIDE = 'ELEVEN_A_SIDE',
}

export enum ConvType {
  DIRECT = 'DIRECT',
  MATCH = 'MATCH',
  MATCH_GROUP = 'MATCH_GROUP',
  GROUP = 'GROUP',
  PITCH_HIRE = 'PITCH_HIRE',
}

export enum PitchBookingType {
  GROUP_HIRE = 'GROUP_HIRE',
  OPEN_JOIN = 'OPEN_JOIN',
}

export enum PitchBookingStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  CONFIRMED = 'CONFIRMED',
  CANCELLED_REFUND = 'CANCELLED_REFUND',
  CANCELLED_PENALTY = 'CANCELLED_PENALTY',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
}

// ─── User Types ───────────────────────────────────────────────────────────────

export interface IUser {
  id: string;
  phone: string;
  name: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  bio: string | null;
  gender: Gender;
  dateOfBirth: Date | null;
  city: string;
  district: string | null;
  country: string;
  role: UserRole;
  skillLevel: SkillLevel;
  eloRating: number;
  preferredSport: Sport;
  preferredPositions: MatchPosition[];
  isVerified: boolean;
  isActive: boolean;
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserPublic {
  id: string;
  firstName: string;
  lastName: string;
  name?: string;
  username?: string;
  avatarUrl: string | null;
  bio: string | null;
  gender?: Gender;
  city?: string;
  country?: string;
  skillLevel?: SkillLevel;
  eloRating: number;
  preferredSport?: Sport;
  preferredPositions?: MatchPosition[];
  isVerified?: boolean;
  lastActiveAt?: Date | null;
}

// ─── Pitch Types ──────────────────────────────────────────────────────────────

export interface IPitch {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  sport: Sport;
  size: PitchSize;
  surface: SurfaceType;
  amenities: AmenityType[];
  city: string;
  district: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  hourlyRate: number;
  currency: string;
  isActive: boolean;
  isVerified: boolean;
  imageUrls: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IPitchDetail extends IPitch {
  owner: IUserPublic;
  averageRating: number;
  totalBookings: number;
}

// ─── Match Types ──────────────────────────────────────────────────────────────

export interface IMatchPosition {
  id: string;
  matchId: string;
  userId: string | null;
  position: MatchPosition;
  team: TeamSide;
  isConfirmed: boolean;
  joinedAt: Date | null;
  user?: IUserPublic;
}

export interface IFormationTeam {
  home: IMatchPosition[];
  away: IMatchPosition[];
}

export interface IMatch {
  id: string;
  organizerId: string;
  pitchId: string;
  hostId?: string;
  title: string;
  description: string | null;
  sport: Sport;
  status: MatchStatus;
  formation: string;
  format?: string;
  maxPlayers: number;
  minPlayers?: number;
  currentPlayers: number;
  startTime: Date;
  scheduledAt?: Date;
  durationMinutes: number;
  pricePerPlayer: number;
  currency?: string;
  isCoEd?: boolean;
  skillFilter?: string | null;
  isPublic?: boolean;
  allowWatchers?: boolean;
  city?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMatchDetail extends IMatch {
  organizer: IUserPublic;
  pitch: IPitch;
  positions: IFormationTeam;
  userBooking?: IBooking;
}

export interface IMatchFormation {
  matchId: string;
  formation: string;
  home: Array<{
    position: MatchPosition;
    x: number;
    y: number;
    player: IUserPublic | null;
    isConfirmed: boolean;
  }>;
  away: Array<{
    position: MatchPosition;
    x: number;
    y: number;
    player: IUserPublic | null;
    isConfirmed: boolean;
  }>;
}

// ─── Booking Types ────────────────────────────────────────────────────────────

export interface IBooking {
  id: string;
  userId: string;
  matchId: string | null;
  pitchId: string;
  status: BookingStatus;
  scheduledAt: Date;
  durationMinutes: number;
  totalAmount: number;
  platformFee: number;
  pitchOwnerAmount: number;
  currency: string;
  position: MatchPosition | null;
  team: TeamSide | null;
  notes: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBookingDetail extends IBooking {
  user: IUserPublic;
  pitch: IPitch;
  match: IMatch | null;
  transaction: ITransaction | null;
}

// ─── Transaction Types ────────────────────────────────────────────────────────

export interface ITransaction {
  id: string;
  userId: string;
  bookingId: string | null;
  gateway: PaymentGateway;
  status: TransactionStatus;
  amount: number;
  currency: string;
  externalId: string | null;
  externalRef: string | null;
  metadata: Record<string, unknown> | null;
  paidAt: Date | null;
  failedAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Player Rating Types ──────────────────────────────────────────────────────

export interface IPlayerRating {
  id: string;
  matchId: string;
  raterId: string;
  ratedId: string;
  overall: number;
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physical: number | null;
  comment: string | null;
  createdAt: Date;
  rater?: IUserPublic;
  rated?: IUserPublic;
}

// ─── Notification Types ───────────────────────────────────────────────────────

export interface INotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

// ─── Conversation & Message Types ─────────────────────────────────────────────

export interface IConversation {
  id: string;
  type: ConvType;
  matchId: string | null;
  name: string | null;
  imageUrl: string | null;
  participantIds: string[];
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  participants?: IUserPublic[];
  lastMessage?: IMessage;
  unreadCount?: number;
}

export interface IMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  imageUrl: string | null;
  isRead: boolean;
  readAt: Date | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  sender?: IUserPublic;
}

// ─── Pitch Booking Types ──────────────────────────────────────────────────────

export interface IPitchBookingParticipant {
  id: string;
  pitchBookingId: string;
  userId: string;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
  user?: IUserPublic;
}

export interface IPitchBooking {
  id: string;
  pitchId: string;
  hostId: string;
  title: string;
  type: PitchBookingType;
  status: PitchBookingStatus;
  startTime: Date;
  endTime: Date;
  durationHours: number;
  totalPrice: number;
  maxParticipants: number | null;
  currentParticipants: number;
  notes: string | null;
  conversationId: string | null;
  cancellationDeadlineHours: number;
  createdAt: Date;
  updatedAt: Date;
  pitch?: IPitch;
  host?: IUserPublic;
  participants?: IPitchBookingParticipant[];
}
