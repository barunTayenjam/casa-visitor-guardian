import { describe, it, expect, beforeEach } from '@jest/globals';
import { InMemoryStateService, inMemoryState } from './inMemoryStateService.js';
import type { MotionEvent, Alert, SystemSettings } from './inMemoryStateService.js';

describe('InMemoryStateService', () => {
  let service: InMemoryStateService;

  beforeEach(() => {
    service = new InMemoryStateService();
  });

  describe('addRecentEvent / getRecentEvents', () => {
    it('should return empty array when no events added', () => {
      expect(service.getRecentEvents()).toEqual([]);
    });

    it('should return array with 1 item after adding one event', () => {
      const event: MotionEvent = {
        id: 'evt-1',
        cameraId: 'cam1',
        timestamp: '2026-01-01T00:00:00Z',
        imagePath: '/events/motion_1.jpg',
        confidence: 75,
        duration: 100,
      };
      service.addRecentEvent(event);
      const events = service.getRecentEvents();
      expect(events.length).toBe(1);
      expect(events[0].id).toBe('evt-1');
    });

    it('should cap at 100 events when adding more', () => {
      for (let i = 0; i < 101; i++) {
        service.addRecentEvent({
          id: `evt-${i}`,
          cameraId: 'cam1',
          timestamp: `2026-01-01T${String(i).padStart(2, '0')}:00:00Z`,
          imagePath: `/events/motion_${i}.jpg`,
          confidence: 50,
          duration: 100,
        });
      }
      const events = service.getRecentEvents();
      expect(events.length).toBe(100);
    });

    it('should return events in reverse chronological order (newest first)', () => {
      service.addRecentEvent({
        id: 'evt-old',
        cameraId: 'cam1',
        timestamp: '2026-01-01T00:00:00Z',
        imagePath: '/events/old.jpg',
        confidence: 50,
        duration: 100,
      });
      service.addRecentEvent({
        id: 'evt-new',
        cameraId: 'cam1',
        timestamp: '2026-01-01T01:00:00Z',
        imagePath: '/events/new.jpg',
        confidence: 60,
        duration: 100,
      });
      const events = service.getRecentEvents();
      expect(events[0].id).toBe('evt-new');
      expect(events[1].id).toBe('evt-old');
    });

    it('should keep only the most recent 100 events (oldest dropped)', () => {
      for (let i = 0; i < 105; i++) {
        service.addRecentEvent({
          id: `evt-${i}`,
          cameraId: 'cam1',
          timestamp: `2026-01-01T${String(i % 24).padStart(2, '0')}:00:00Z`,
          imagePath: `/events/motion_${i}.jpg`,
          confidence: 50,
          duration: 100,
        });
      }
      const events = service.getRecentEvents();
      // The last event added should be evt-104 (most recent)
      expect(events[0].id).toBe('evt-104');
      // The first event should be evt-5 (oldest kept)
      expect(events[99].id).toBe('evt-5');
    });
  });

  describe('clearRecentEvents', () => {
    it('should clear all events', () => {
      service.addRecentEvent({
        id: 'evt-1',
        cameraId: 'cam1',
        timestamp: '2026-01-01T00:00:00Z',
        imagePath: '/events/1.jpg',
        confidence: 50,
        duration: 100,
      });
      service.clearRecentEvents();
      expect(service.getRecentEvents()).toEqual([]);
    });
  });

  describe('addAlert / getAlerts', () => {
    it('should return empty array when no alerts added', () => {
      expect(service.getAlerts()).toEqual([]);
    });

    it('should add alert with auto-generated id and timestamp', () => {
      service.addAlert({
        type: 'motion',
        severity: 'warning',
        message: 'Motion detected',
      });
      const alerts = service.getAlerts();
      expect(alerts.length).toBe(1);
      expect(alerts[0].id).toBeDefined();
      expect(alerts[0].timestamp).toBeInstanceOf(Date);
      expect(alerts[0].acknowledged).toBe(false);
      expect(alerts[0].type).toBe('motion');
      expect(alerts[0].severity).toBe('warning');
      expect(alerts[0].message).toBe('Motion detected');
    });

    it('should cap at 100 alerts when adding more', () => {
      for (let i = 0; i < 101; i++) {
        service.addAlert({
          type: 'system',
          severity: 'info',
          message: `Alert ${i}`,
        });
      }
      const alerts = service.getAlerts();
      expect(alerts.length).toBe(100);
    });

    it('should return alerts in reverse chronological order', () => {
      service.addAlert({ type: 'motion', severity: 'info', message: 'First' });
      service.addAlert({ type: 'system', severity: 'warning', message: 'Second' });
      const alerts = service.getAlerts();
      expect(alerts[0].message).toBe('Second');
      expect(alerts[1].message).toBe('First');
    });
  });

  describe('acknowledgeAlert', () => {
    it('should mark alert as acknowledged', () => {
      service.addAlert({ type: 'motion', severity: 'warning', message: 'Test' });
      const alerts = service.getAlerts();
      const alertId = alerts[0].id;
      const result = service.acknowledgeAlert(alertId);
      expect(result).toBe(true);
      expect(service.getAlerts()[0].acknowledged).toBe(true);
    });

    it('should return false for non-existent alert', () => {
      const result = service.acknowledgeAlert('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('deleteAlert', () => {
    it('should remove alert by id', () => {
      service.addAlert({ type: 'motion', severity: 'warning', message: 'To Delete' });
      const alerts = service.getAlerts();
      const alertId = alerts[0].id;
      const result = service.deleteAlert(alertId);
      expect(result).toBe(true);
      expect(service.getAlerts().length).toBe(0);
    });

    it('should return false for non-existent alert', () => {
      const result = service.deleteAlert('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('clearAlerts', () => {
    it('should clear all alerts', () => {
      service.addAlert({ type: 'motion', severity: 'warning', message: 'Alert 1' });
      service.addAlert({ type: 'system', severity: 'error', message: 'Alert 2' });
      service.clearAlerts();
      expect(service.getAlerts()).toEqual([]);
    });
  });

  describe('System settings CRUD', () => {
    it('should return default settings when none set', () => {
      const settings = service.getSystemSettings();
      expect(settings).toBeDefined();
      expect(settings.general.systemName).toBe('Security System');
      expect(settings.general.timezone).toBe('UTC');
      expect(settings.storage.retentionDays).toBe(7);
      expect(settings.notifications.pushEnabled).toBe(true);
    });

    it('should store and retrieve custom settings', () => {
      const customSettings: SystemSettings = {
        general: {
          systemName: 'My Custom System',
          timezone: 'Asia/Kolkata',
          language: 'hi',
          theme: 'dark',
          autoBackup: false,
          backupFrequency: 'weekly',
        },
        storage: {
          retentionDays: 30,
          maxStorageGB: 500,
          autoCleanup: true,
          compressionEnabled: true,
          compressionQuality: 90,
        },
        notifications: {
          emailEnabled: true,
          emailAddress: 'test@example.com',
          pushEnabled: false,
          pushSoundEnabled: false,
          quietHoursEnabled: true,
          quietHoursStart: '23:00',
          quietHoursEnd: '06:00',
        },
      };
      service.setSystemSettings(customSettings);
      const retrieved = service.getSystemSettings();
      expect(retrieved.general.systemName).toBe('My Custom System');
      expect(retrieved.general.timezone).toBe('Asia/Kolkata');
      expect(retrieved.storage.retentionDays).toBe(30);
      expect(retrieved.notifications.emailEnabled).toBe(true);
    });

    it('should return default settings after clearing', () => {
      service.setSystemSettings({
        general: {
          systemName: 'Custom',
          timezone: 'EST',
          language: 'en',
          theme: 'light',
          autoBackup: false,
          backupFrequency: 'monthly',
        },
        storage: {
          retentionDays: 14,
          maxStorageGB: 200,
          autoCleanup: false,
          compressionEnabled: false,
          compressionQuality: 50,
        },
        notifications: {
          emailEnabled: false,
          emailAddress: '',
          pushEnabled: true,
          pushSoundEnabled: true,
          quietHoursEnabled: false,
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
        },
      });
      service.clearSystemSettings();
      const settings = service.getSystemSettings();
      expect(settings.general.systemName).toBe('Security System');
    });

    it('should return a copy of default settings (not reference)', () => {
      const settings1 = service.getDefaultSettings();
      const settings2 = service.getDefaultSettings();
      expect(settings1).toEqual(settings2);
      expect(settings1).not.toBe(settings2); // Different objects
    });
  });

  describe('Thread safety', () => {
    it('should return a copy of events array, not the original', () => {
      service.addRecentEvent({
        id: 'evt-1',
        cameraId: 'cam1',
        timestamp: '2026-01-01T00:00:00Z',
        imagePath: '/events/1.jpg',
        confidence: 50,
        duration: 100,
      });
      const events = service.getRecentEvents();
      events.push({
        id: 'evt-external',
        cameraId: 'cam1',
        timestamp: '2026-01-01T00:00:00Z',
        imagePath: '/events/external.jpg',
        confidence: 99,
        duration: 100,
      });
      // The service's internal array should not be affected
      expect(service.getRecentEvents().length).toBe(1);
    });

    it('should return a copy of alerts array, not the original', () => {
      service.addAlert({ type: 'motion', severity: 'info', message: 'Test' });
      const alerts = service.getAlerts();
      alerts.push({
        id: 'alert-external',
        type: 'system',
        severity: 'error',
        message: 'External',
        timestamp: new Date(),
        acknowledged: false,
      });
      // The service's internal array should not be affected
      expect(service.getAlerts().length).toBe(1);
    });
  });

  describe('Singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(inMemoryState).toBeDefined();
      expect(inMemoryState).toBeInstanceOf(InMemoryStateService);
    });
  });
});
