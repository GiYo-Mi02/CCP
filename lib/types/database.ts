/**
 * CCP Database Type Definitions
 *
 * These types mirror the Supabase PostgreSQL schema and are used to
 * provide type-safety across Server Actions, Server Components, and
 * Client Components. Regenerate with `supabase gen types` after schema changes.
 */

// ─── Enum Types ──────────────────────────────────────────────────────
export type UserRole       = 'admin' | 'delegate';
export type SessionStatus  = 'draft' | 'active' | 'concluded';
export type PeriodType     = 'amendment' | 'insertion' | 'quash' | 'quick_motion' | 'election' | 'final_votation';
export type PeriodState    = 'pending' | 'active' | 'votation' | 'results' | 'closed';
export type MotionType     = 'amendment' | 'insertion' | 'quash' | 'quick_motion';
export type MotionStatus   = 'pending' | 'approved' | 'rejected';
export type VoteValue      = 'adapt' | 'quash' | 'abstain';
export type ElectionStatus = 'pending' | 'active' | 'closed';

// ─── Row Types ───────────────────────────────────────────────────────

export interface Profile {
  id: string;
  full_name: string;
  college: string;
  committee: string;
  credentials: string[];
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  name: string;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
}

export interface Period {
  id: string;
  session_id: string;
  period_type: PeriodType;
  state: PeriodState;
  deadline: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Motion {
  id: string;
  period_id: string;
  author_id: string;
  motion_type: MotionType;
  article_ref: string;
  section_ref: string;
  original_text: string | null;
  proposed_text: string | null;
  justification: string | null;
  status: MotionStatus;
  created_at: string;
  updated_at: string;
}

export interface Vote {
  id: string;
  motion_id: string;
  voter_id: string;
  vote_value: VoteValue;
  cast_at: string;
}

export interface Election {
  id: string;
  session_id: string;
  name: string;
  status: ElectionStatus;
  created_at: string;
}

export interface ElectionPosition {
  id: string;
  election_id: string;
  title: string;
  scope: string;
}

export interface Candidate {
  id: string;
  profile_id: string;
  position_id: string;
}

export interface ElectionVote {
  id: string;
  voter_id: string;
  position_id: string;
  candidate_id: string;
  cast_at: string;
}

// ─── RPC Return Types ────────────────────────────────────────────────

export interface MotionResults {
  total_votes: number;
  adapt_count: number;
  quash_count: number;
  abstain_count: number;
  adapt_pct: number;
  quash_pct: number;
  abstain_pct: number;
}

// ─── Supabase Database Interface ─────────────────────────────────────
// Full shape required by @supabase/supabase-js for generic type inference.
// Includes Views, Functions, Enums, and CompositeTypes.

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      sessions: {
        Row: Session;
        Insert: Omit<Session, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Session>;
        Relationships: [];
      };
      periods: {
        Row: Period;
        Insert: Omit<Period, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Period>;
        Relationships: [
          {
            foreignKeyName: 'periods_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          }
        ];
      };
      motions: {
        Row: Motion;
        Insert: Omit<Motion, 'id' | 'created_at' | 'updated_at' | 'status'> & { id?: string; status?: MotionStatus };
        Update: Partial<Motion>;
        Relationships: [
          {
            foreignKeyName: 'motions_period_id_fkey';
            columns: ['period_id'];
            isOneToOne: false;
            referencedRelation: 'periods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'motions_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      votes: {
        Row: Vote;
        Insert: Omit<Vote, 'id' | 'cast_at'> & { id?: string };
        Update: Partial<Vote>;
        Relationships: [
          {
            foreignKeyName: 'votes_motion_id_fkey';
            columns: ['motion_id'];
            isOneToOne: false;
            referencedRelation: 'motions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'votes_voter_id_fkey';
            columns: ['voter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      elections: {
        Row: Election;
        Insert: Omit<Election, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Election>;
        Relationships: [
          {
            foreignKeyName: 'elections_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          }
        ];
      };
      election_positions: {
        Row: ElectionPosition;
        Insert: Omit<ElectionPosition, 'id'> & { id?: string };
        Update: Partial<ElectionPosition>;
        Relationships: [
          {
            foreignKeyName: 'election_positions_election_id_fkey';
            columns: ['election_id'];
            isOneToOne: false;
            referencedRelation: 'elections';
            referencedColumns: ['id'];
          }
        ];
      };
      candidates: {
        Row: Candidate;
        Insert: Omit<Candidate, 'id'> & { id?: string };
        Update: Partial<Candidate>;
        Relationships: [
          {
            foreignKeyName: 'candidates_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'candidates_position_id_fkey';
            columns: ['position_id'];
            isOneToOne: false;
            referencedRelation: 'election_positions';
            referencedColumns: ['id'];
          }
        ];
      };
      election_votes: {
        Row: ElectionVote;
        Insert: Omit<ElectionVote, 'id' | 'cast_at'> & { id?: string };
        Update: Partial<ElectionVote>;
        Relationships: [
          {
            foreignKeyName: 'election_votes_voter_id_fkey';
            columns: ['voter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'election_votes_position_id_fkey';
            columns: ['position_id'];
            isOneToOne: false;
            referencedRelation: 'election_positions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'election_votes_candidate_id_fkey';
            columns: ['candidate_id'];
            isOneToOne: false;
            referencedRelation: 'candidates';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      cast_vote: {
        Args: { p_motion_id: string; p_voter_id: string; p_value: VoteValue };
        Returns: string;
      };
      get_motion_results: {
        Args: { p_motion_id: string };
        Returns: MotionResults[];
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      session_status: SessionStatus;
      period_type: PeriodType;
      period_state: PeriodState;
      motion_type: MotionType;
      motion_status: MotionStatus;
      vote_value: VoteValue;
      election_status: ElectionStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
