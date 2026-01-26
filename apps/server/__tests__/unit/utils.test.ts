import { describe, it, expect, vi } from 'vitest';
import {
  cn,
  formatBytes,
  formatDuration,
  formatDate,
  formatRelativeTime,
  generateId,
  sleep,
} from '../../src/lib/utils';

describe('Utils', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      const result = cn('class1', 'class2');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
    });

    it('should handle conditional classes', () => {
      const result = cn('base', { active: true, disabled: false });
      expect(result).toContain('base');
      expect(result).toContain('active');
      expect(result).not.toContain('disabled');
    });

    it('should merge Tailwind classes properly', () => {
      const result = cn('px-4 py-2', 'px-6');
      expect(result).toContain('px-6');
      expect(result).not.toContain('px-4');
    });

    it('should handle arrays', () => {
      const result = cn(['class1', 'class2']);
      expect(result).toContain('class1');
      expect(result).toContain('class2');
    });

    it('should handle undefined and null', () => {
      const result = cn('base', undefined, null, 'extra');
      expect(result).toContain('base');
      expect(result).toContain('extra');
    });
  });

  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatBytes(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(2048)).toBe('2 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should format terabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
    });

    it('should format decimal values', () => {
      const result = formatBytes(1536);
      expect(result).toBe('1.5 KB');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(1000)).toBe('1.00s');
      expect(formatDuration(2500)).toBe('2.50s');
    });

    it('should format minutes', () => {
      expect(formatDuration(60000)).toBe('1.00m');
      expect(formatDuration(90000)).toBe('1.50m');
    });

    it('should format hours', () => {
      expect(formatDuration(3600000)).toBe('1.00h');
      expect(formatDuration(7200000)).toBe('2.00h');
    });
  });

  describe('formatDate', () => {
    it('should format Date object', () => {
      const date = new Date('2024-01-15T10:30:00');
      const result = formatDate(date);
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });

    it('should format date string', () => {
      const result = formatDate('2024-06-20T14:00:00');
      expect(result).toContain('Jun');
      expect(result).toContain('20');
      expect(result).toContain('2024');
    });
  });

  describe('formatRelativeTime', () => {
    it('should return "just now" for recent times', () => {
      const now = new Date();
      expect(formatRelativeTime(now)).toBe('just now');
    });

    it('should return minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
    });

    it('should return hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
    });

    it('should return days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
    });

    it('should handle string dates', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      expect(ids.size).toBe(100);
    });

    it('should generate IDs without prefix', () => {
      const id = generateId();
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate IDs with prefix', () => {
      const id = generateId('user');
      expect(id).toMatch(/^user_/);
    });

    it('should generate IDs with custom prefix', () => {
      const id = generateId('tunnel');
      expect(id.startsWith('tunnel_')).toBe(true);
    });
  });

  describe('sleep', () => {
    it('should delay execution', async () => {
      vi.useFakeTimers();
      const promise = sleep(100);
      vi.advanceTimersByTime(100);
      await expect(promise).resolves.toBeUndefined();
      vi.useRealTimers();
    });

    it('should return a Promise', () => {
      const result = sleep(0);
      expect(result).toBeInstanceOf(Promise);
    });
  });
});
