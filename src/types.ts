export interface UserLocation {
  lat: number;
  lng: number;
  updatedAt: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: 'admin' | 'user';
  userType: 'user' | 'master' | 'programmer';
  status: 'active' | 'pending' | 'rejected';
  banned?: boolean;
  isOnline?: boolean;
  lastSeen?: any;
  location?: UserLocation;
  showLocation?: boolean;
  phoneNumber?: string;
  workplaceName?: string;
  workplaceAddress?: string;
  shopPhotoURL?: string;
  equipmentPhotoURL?: string;
  createdAt?: any;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  content: string;
  createdAt: any;
  read: boolean;
  chatId?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  link?: string;
  createdAt: any;
  read: boolean;
}

export interface Post {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL?: string;
  title: string;
  content: string;
  createdAt: any;
  category: string;
  likes?: string[];
}

export interface Comment {
  id: string;
  postId: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL?: string;
  content: string;
  createdAt: any;
  likes?: string[];
  isEdited?: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  isDigital?: boolean;
  downloadUrl?: string;
}

export interface PurchaseRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  productId: string;
  productName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  downloaded?: boolean;
  price?: number;
}

export interface FrpRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  phoneModel: string;
  androidVersion: string;
  imei: string;
  serialNumber: string;
  status: 'pending' | 'price_set' | 'paid' | 'completed' | 'rejected';
  price?: number;
  createdAt: any;
  updatedAt?: any;
}

export interface RepairGuide {
  id: string;
  title: string;
  problem: string;
  solution: string;
  steps: string[];
}

export interface BrandUpdate {
  id: string;
  brand: string;
  title: string;
  content: string;
  date: string;
  imageUrl?: string;
}

export interface Ad {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  link?: string;
  placement: 'home' | 'shop' | 'forum' | 'all';
  active: boolean;
  createdAt: any;
}

export interface RentableTool {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  prices: { [duration: string]: number }; // e.g., { "1h": 2, "24h": 10 }
  category: string;
  active: boolean;
}

export interface RentalRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  toolId: string;
  toolName: string;
  duration: string;
  price: number;
  status: 'pending' | 'active' | 'completed' | 'rejected';
  startTime?: any;
  endTime?: any;
  credentials?: string;
  createdAt: any;
}
