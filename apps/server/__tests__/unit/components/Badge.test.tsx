import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, badgeVariants } from '../../../src/components/ui/badge';

describe('Badge', () => {
  describe('rendering', () => {
    it('should render with default props', () => {
      render(<Badge>Badge Text</Badge>);
      expect(screen.getByText('Badge Text')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<Badge className="custom-class">Badge</Badge>);
      expect(screen.getByText('Badge')).toHaveClass('custom-class');
    });
  });

  describe('variants', () => {
    it('should render default variant', () => {
      render(<Badge variant="default">Default</Badge>);
      const badge = screen.getByText('Default');
      expect(badge).toHaveClass('bg-primary');
    });

    it('should render secondary variant', () => {
      render(<Badge variant="secondary">Secondary</Badge>);
      const badge = screen.getByText('Secondary');
      expect(badge).toHaveClass('bg-secondary');
    });

    it('should render destructive variant', () => {
      render(<Badge variant="destructive">Destructive</Badge>);
      const badge = screen.getByText('Destructive');
      expect(badge).toHaveClass('bg-destructive');
    });

    it('should render outline variant', () => {
      render(<Badge variant="outline">Outline</Badge>);
      const badge = screen.getByText('Outline');
      expect(badge).toHaveClass('text-foreground');
    });
  });

  describe('composition', () => {
    it('should render with icon', () => {
      render(
        <Badge>
          <span data-testid="icon">🔔</span>
          Notification
        </Badge>
      );
      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByText('Notification')).toBeInTheDocument();
    });

    it('should render multiple badges', () => {
      render(
        <div>
          <Badge variant="default">Tag 1</Badge>
          <Badge variant="secondary">Tag 2</Badge>
          <Badge variant="destructive">Tag 3</Badge>
        </div>
      );
      expect(screen.getByText('Tag 1')).toBeInTheDocument();
      expect(screen.getByText('Tag 2')).toBeInTheDocument();
      expect(screen.getByText('Tag 3')).toBeInTheDocument();
    });
  });

  describe('props forwarding', () => {
    it('should forward HTML props', () => {
      render(<Badge data-testid="test-badge" id="my-badge">Badge</Badge>);
      const badge = screen.getByTestId('test-badge');
      expect(badge).toHaveAttribute('id', 'my-badge');
    });
  });
});

describe('badgeVariants', () => {
  it('should return correct classes for default variant', () => {
    const classes = badgeVariants({ variant: 'default' });
    expect(classes).toContain('bg-primary');
  });

  it('should return correct classes for secondary variant', () => {
    const classes = badgeVariants({ variant: 'secondary' });
    expect(classes).toContain('bg-secondary');
  });

  it('should return correct classes for destructive variant', () => {
    const classes = badgeVariants({ variant: 'destructive' });
    expect(classes).toContain('bg-destructive');
  });

  it('should return correct classes for outline variant', () => {
    const classes = badgeVariants({ variant: 'outline' });
    expect(classes).toContain('text-foreground');
  });

  it('should merge custom className', () => {
    const classes = badgeVariants({ className: 'custom' });
    expect(classes).toContain('custom');
  });

  it('should apply base classes', () => {
    const classes = badgeVariants();
    expect(classes).toContain('inline-flex');
    expect(classes).toContain('rounded-full');
  });
});
