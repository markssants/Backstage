export type UserRole = 'designer' | 'contractor';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: any;
}

export interface EventProject {
  id: string;
  name: string;
  logoUrl?: string;
  driveUrl?: string;
  contractorName?: string;
  city?: string;
  eventDate?: string;
  djCount?: number;
  artCount?: number;
  motionCount?: number;
  location?: string;
  contractorId: string;
  designerId: string;
  contractorEmail?: string;
  designerEmail?: string;
  status: 'planning' | 'ongoing' | 'completed';
  createdAt: any;
  updatedAt?: any;
}

export interface ArtTask {
  id: string;
  eventId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  category: 'dj' | 'party' | 'branding';
  deadline: any;
  status: 'todo' | 'production' | 'review' | 'delivered' | 'post' | 'finished';
  position: number;
  color?: string;
  createdAt: any;
}

export interface DjAsset {
  id: string;
  eventId: string;
  name: string;
  presskitUrl?: string;
  musicName?: string;
  musicUrl?: string;
  musicDuration?: string;
  artDeadline?: string;
  hasMandatoryLogo?: boolean;
  agencyInfo?: string;
  labelInfo?: string;
  flyerPhoto?: string;
  animationVideo?: string;
  priority?: 'low' | 'medium' | 'urgent';
  presskitStatus?: 'pending' | 'completed';
  createdAt: any;
}

export interface ProjectDocument {
  id: string;
  eventId: string;
  type: 'contract' | 'receipt' | 'proposal';
  status: 'pending' | 'signed';
  url: string;
  name: string;
  thumbnailUrl?: string;
  createdAt: any;
  updatedAt?: any;
}

export interface PaymentItem {
  id: string;
  eventId: string;
  description: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  dueDate: any;
  paidAt?: any;
  createdAt: any;
  updatedAt?: any;
}

export type ViewType = 'overview' | 'arts' | 'dj' | 'docs' | 'payments' | 'files' | 'profile' | 'about' | 'admin';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

export interface PendingChange {
  id: string;
  type: 'create' | 'update' | 'status' | 'delete';
  proposedData: any;
  originalData: any;
  targetId: string;
  title: string;
  contractorName: string;
  contractorEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
}
