import { cn, formatDuration, truncate, getInitials } from '../lib/utils';

describe('Utils', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      const result = cn('foo', 'bar');
      expect(result).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      const result = cn('base', true && 'included', false && 'excluded');
      expect(result).toBe('base included');
    });

    it('should merge tailwind classes correctly', () => {
      const result = cn('p-4', 'p-8');
      expect(result).toBe('p-8');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds only', () => {
      expect(formatDuration(45)).toBe('45s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(125)).toBe('2m 5s');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(3725)).toBe('1h 2m');
    });
  });

  describe('truncate', () => {
    it('should not truncate short text', () => {
      expect(truncate('Hello', 10)).toBe('Hello');
    });

    it('should truncate long text with ellipsis', () => {
      expect(truncate('Hello World', 8)).toBe('Hello...');
    });
  });

  describe('getInitials', () => {
    it('should get initials from single name', () => {
      expect(getInitials('John')).toBe('J');
    });

    it('should get initials from full name', () => {
      expect(getInitials('John Doe')).toBe('JD');
    });

    it('should limit to two characters', () => {
      expect(getInitials('John Michael Doe')).toBe('JM');
    });
  });
});
