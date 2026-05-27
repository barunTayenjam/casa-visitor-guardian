export interface EventRow {
  id: string;
  event_type: string;
  timestamp: string;
  camera_id: string;
  confidence: number;
  file_path: string | null;
  metadata: unknown;
  persons_detected: number;
  faces_detected: number;
  known_faces_count: number;
  object_detections: unknown;
  face_detections: unknown;
  label: string | null;
  is_read: boolean | null;
}

export interface EventResponse {
  id: string;
  event_type: string;
  cameraId: string;
  timestamp: string;
  imagePath: string | null;
  confidence: number;
  persons_detected: number;
  faces_detected: number;
  known_faces_count: number;
  label: string | null;
  is_read: boolean | null;
  object_detections: unknown;
  face_detections: unknown;
}

export interface HistoryEventResponse {
  id: string;
  cameraId: string;
  timestamp: string;
  imagePath: string;
  imageUrl: string;
  confidence: number;
  labels: string[];
  location: string;
  duration: number;
  cameraName: string;
  event_type: string;
}

export interface EventListFilters {
  page?: string;
  pageSize?: string;
  event_type?: string;
  camera_id?: string;
  start_date?: string;
  end_date?: string;
  searchQuery?: string;
  sortBy?: string;
  min_confidence?: string;
  max_confidence?: string;
  face_status?: string;
}
