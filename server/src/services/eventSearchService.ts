export { EventSearchService } from './eventSearch/eventSearchService.js';
export type {
  EventSearchFilters,
  EventSearchResponse,
  ListEnhancedFilters,
  DetectionEventFilters,
} from './eventSearch/types.js';
import { EventSearchService } from './eventSearch/eventSearchService.js';
const instance = new EventSearchService();
export default instance;
