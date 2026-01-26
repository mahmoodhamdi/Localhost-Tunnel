import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton } from '../../../src/components/ui/skeleton';

describe('Skeleton', () => {
  describe('rendering', () => {
    it('should render with default props', () => {
      render(<Skeleton data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('should render as a div element', () => {
      render(<Skeleton data-testid="skeleton" />);
      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton.tagName.toLowerCase()).toBe('div');
    });
  });

  describe('className handling', () => {
    it('should apply custom className', () => {
      render(<Skeleton className="custom-skeleton" data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toHaveClass('custom-skeleton');
    });

    it('should merge custom className with default styles', () => {
      render(<Skeleton className="w-full h-10" data-testid="skeleton" />);
      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveClass('w-full');
      expect(skeleton).toHaveClass('h-10');
      expect(skeleton).toHaveClass('animate-pulse');
    });

    it('should have animate-pulse class by default', () => {
      render(<Skeleton data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toHaveClass('animate-pulse');
    });

    it('should have rounded-md class by default', () => {
      render(<Skeleton data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toHaveClass('rounded-md');
    });

    it('should have bg-muted class by default', () => {
      render(<Skeleton data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toHaveClass('bg-muted');
    });
  });

  describe('props forwarding', () => {
    it('should forward data attributes', () => {
      render(<Skeleton data-testid="skeleton" data-custom="value" />);
      expect(screen.getByTestId('skeleton')).toHaveAttribute('data-custom', 'value');
    });

    it('should forward id attribute', () => {
      render(<Skeleton id="my-skeleton" data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toHaveAttribute('id', 'my-skeleton');
    });

    it('should forward role attribute', () => {
      render(<Skeleton role="progressbar" data-testid="skeleton" />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should forward aria attributes', () => {
      render(<Skeleton aria-label="Loading" data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-label', 'Loading');
    });
  });

  describe('children handling', () => {
    it('should render without children', () => {
      render(<Skeleton data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toBeEmptyDOMElement();
    });

    it('should render with children if provided', () => {
      render(
        <Skeleton data-testid="skeleton">
          <span>Loading content</span>
        </Skeleton>
      );
      expect(screen.getByText('Loading content')).toBeInTheDocument();
    });
  });

  describe('composition patterns', () => {
    it('should render text skeleton', () => {
      render(<Skeleton className="h-4 w-[200px]" data-testid="text-skeleton" />);
      const skeleton = screen.getByTestId('text-skeleton');
      expect(skeleton).toHaveClass('h-4');
      expect(skeleton).toHaveClass('w-[200px]');
    });

    it('should render circle skeleton for avatar', () => {
      render(<Skeleton className="h-12 w-12 rounded-full" data-testid="avatar-skeleton" />);
      const skeleton = screen.getByTestId('avatar-skeleton');
      expect(skeleton).toHaveClass('h-12');
      expect(skeleton).toHaveClass('w-12');
      expect(skeleton).toHaveClass('rounded-full');
    });

    it('should render card skeleton', () => {
      render(
        <div data-testid="card-skeleton">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-4 w-[250px] mt-4" />
          <Skeleton className="h-4 w-[200px] mt-2" />
        </div>
      );
      expect(screen.getByTestId('card-skeleton').querySelectorAll('.animate-pulse').length).toBe(3);
    });

    it('should render skeleton group', () => {
      render(
        <div className="space-y-2" data-testid="skeleton-group">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4" data-testid={`skeleton-${i}`} />
          ))}
        </div>
      );
      expect(screen.getAllByTestId(/skeleton-\d/).length).toBe(5);
    });
  });

  describe('accessibility', () => {
    it('should be accessible with aria-busy', () => {
      render(<Skeleton aria-busy="true" data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-busy', 'true');
    });

    it('should be accessible with role status', () => {
      render(<Skeleton role="status" aria-label="Loading content" data-testid="skeleton" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});
