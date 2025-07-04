# Frontend Components Status & To-Do List

> **📋 Note**: This file contains legacy component-specific todos. For the comprehensive project roadmap, see [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md)

## 🟢 Working Components (Real Data)
- **CameraStream.tsx** - ✅ Live streaming from real cameras
- **CameraGrid.tsx** - ✅ Displays real cameras from backend
- **CameraContext.tsx** - ✅ Fetches real camera data from API
- **SocketService.ts** - ✅ Real WebSocket connection for streaming
- **ApiService.ts** - ✅ Real API calls to backend

## ✅ COMPLETED - Previously Partially Working Components

### 1. **AnalyticsChart.tsx** - ✅ COMPLETED
**Status**: ✅ Now fully working with real backend data
**Fixed**:
- ✅ `eventsToday` - Real data from motion events
- ✅ `eventsThisWeek` - Real data from `/api/analytics/weekly`
- ✅ `eventsThisMonth` - Real data from `/api/analytics/monthly`  
- ✅ `averageResponseTime` - Real data from `/api/analytics/response-time`
- ✅ `hourlyData` - Real data from `/api/analytics/hourly`

**Backend APIs Implemented**:
- ✅ `GET /api/analytics/weekly` - Weekly event aggregation
- ✅ `GET /api/analytics/monthly` - Monthly event aggregation
- ✅ `GET /api/analytics/hourly` - Hourly event breakdown
- ✅ `GET /api/analytics/response-time` - System response time metrics

### 2. **SystemOverview.tsx** - ✅ COMPLETED
**Status**: ✅ Now fully working with real backend data
**Fixed**:
- ✅ `totalCameras` - Real data from CameraContext
- ✅ `onlineCameras` - Real data from CameraContext
- ✅ `todayEvents` - Real data from EventsContext
- ✅ `uptime` - Real data from `/api/system/health`
- ✅ `storageUsed` - Real data from `/api/system/storage`
- ✅ `storageTotal` - Real data from `/api/system/storage`
- ✅ `status` - Real data from `/api/system/health`

**Backend APIs Implemented**:
- ✅ `GET /api/system/storage` - Real storage usage calculation
- ✅ `GET /api/system/health` - Comprehensive system health status

### 3. **MediaGallery.tsx** - ✅ IMPROVED
**Status**: ✅ Enhanced with better functionality
**Improvements**:
- ✅ Auto-refresh every 30 seconds
- ✅ Better error handling with fallback empty arrays
- ✅ Added loading states for better UX
- ✅ Improved empty state messaging

### 4. **RecentEvents.tsx** - ✅ ENHANCED
**Status**: ✅ Now loads both socket and historical events
**Improvements**:
- ✅ Loads historical events from API in addition to socket events
- ✅ Combines and deduplicates events from multiple sources
- ✅ Auto-refresh every 2 minutes
- ✅ Better event coverage beyond just socket events

## 🟡 Remaining Partially Working Components

### 5. **MediaViewer.tsx** - PARTIALLY WORKING
**Status**: Calls real API but limited functionality
**Issues**:
- ✅ Calls real `/api/events/list` endpoint
- ⚠️ Only shows recent events in bottom panel
- ⚠️ No filtering by camera or date

**Improvements Needed**:
- Camera filtering
- Date range filtering
- Better integration with main gallery

## 🔴 Components Using Dummy Data (Need Backend Integration)

### 5. **AlertsPanel.tsx** - DUMMY DATA
**Status**: Completely hardcoded alerts
**Issues**:
- ❌ All alerts are hardcoded in component state
- ❌ No real-time alert system
- ❌ No persistence or acknowledgment system

**Backend APIs Needed**:
- `GET /api/alerts` - Get current alerts
- `POST /api/alerts/:id/acknowledge` - Acknowledge alerts
- `DELETE /api/alerts/:id` - Dismiss alerts
- WebSocket events for real-time alerts

### 6. **EventViewer.tsx** - DEPENDS ON PARENT DATA
**Status**: Works with real data when provided, but often gets dummy data
**Issues**:
- ✅ Component itself works correctly
- ❌ Often receives dummy/empty data from parent components
- ❌ No direct API integration

**Improvements Needed**:
- Direct API integration option
- Better loading states
- Error handling for missing images

## 🟡 Pages Needing Backend Integration

### 6. **History.tsx** - LIMITED DATA SOURCE
**Status**: Works but only with EventsContext data
**Issues**:
- ✅ Filtering and search functionality works
- ❌ Only shows events from EventsContext (last 50 events)
- ❌ No access to full historical database

**Backend APIs Needed**:
- `GET /api/events/history` - Full historical events with pagination
- `GET /api/events/search` - Search events by criteria

### 7. **MotionEvents.tsx** - CALLS REAL API
**Status**: Calls real API but may have limited data
**Issues**:
- ✅ Calls real `getMotionEvents()` API
- ⚠️ Backend API returns limited/dummy data
- ⚠️ No real motion detection events stored

**Backend Improvements Needed**:
- Real motion detection event storage
- Better event metadata (confidence, labels, etc.)

### 8. **Settings.tsx** - DUMMY DATA
**Status**: UI works but no backend persistence
**Issues**:
- ✅ UI components and validation work
- ❌ No backend APIs for saving settings
- ❌ All settings are local state only

**Backend APIs Needed**:
- `GET /api/settings` - Get current system settings
- `PUT /api/settings` - Update system settings
- `GET /api/cameras/:id/settings` - Get camera-specific settings
- `PUT /api/cameras/:id/settings` - Update camera settings

## 📋 Priority To-Do List

### High Priority (Core Functionality)
1. **Implement Real Motion Detection Storage**
   - Store motion events in database/filesystem
   - Implement proper event metadata
   - Add event image association

2. **System Metrics Backend APIs**
   - Storage usage monitoring
   - System uptime tracking
   - Health status monitoring
   - Performance metrics

3. **Real Alert System**
   - Motion detection alerts
   - Camera offline alerts
   - System health alerts
   - Real-time WebSocket notifications

### Medium Priority (Enhanced Features)
4. **Analytics Backend APIs**
   - Hourly/daily/weekly/monthly aggregations
   - Response time monitoring
   - Event trend analysis

5. **Settings Persistence**
   - System configuration storage
   - Camera-specific settings
   - User preferences

6. **Historical Event Storage**
   - Full event history database
   - Search and filtering APIs
   - Pagination support

### Low Priority (Nice to Have)
7. **Media Management**
   - Thumbnail generation
   - Image optimization
   - Automatic cleanup policies

8. **Advanced Analytics**
   - Event pattern recognition
   - Predictive analytics
   - Custom reporting

## 🔧 Backend APIs Still Needed

### Analytics
- `GET /api/analytics/weekly` - Weekly event counts
- `GET /api/analytics/monthly` - Monthly event counts  
- `GET /api/analytics/hourly` - Hourly breakdown
- `GET /api/analytics/response-time` - System response metrics

### System Monitoring
- `GET /api/system/storage` - Storage usage stats
- `GET /api/system/uptime` - System uptime
- `GET /api/system/health` - Detailed health status

### Alerts
- `GET /api/alerts` - Current alerts
- `POST /api/alerts/:id/acknowledge` - Acknowledge alert
- `DELETE /api/alerts/:id` - Dismiss alert
- WebSocket: `alert` - Real-time alert notifications

### Settings
- `GET /api/settings` - System settings
- `PUT /api/settings` - Update system settings
- `GET /api/cameras/:id/settings` - Camera settings
- `PUT /api/cameras/:id/settings` - Update camera settings

### Events
- `GET /api/events/history` - Full historical events
- `GET /api/events/search` - Search events
- `POST /api/events/:id/archive` - Archive event

## 📊 Current Backend API Status

### ✅ Implemented
- Camera management (CRUD)
- Camera streaming control
- Basic motion events
- Event/snapshot file listing
- Health check
- Basic system overview

### ❌ Missing
- Analytics aggregation
- Real-time alerts
- Settings persistence  
- Storage monitoring
- Advanced event search
- User management

## 🎯 Next Steps

1. **Start with High Priority items** - Focus on core functionality
2. **Implement motion detection storage** - This will fix multiple components
3. **Add system monitoring APIs** - This will make SystemOverview fully functional
4. **Create real alert system** - This will make AlertsPanel useful
5. **Add analytics APIs** - This will complete AnalyticsChart
6. **Implement settings persistence** - This will make Settings page functional

The frontend architecture is solid and most components are well-designed. The main issue is that many components are designed to work with real data but the backend APIs are not fully implemented yet.