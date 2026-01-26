import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from '../../../src/components/ui/label';

describe('Label', () => {
  describe('rendering', () => {
    it('should render with children', () => {
      render(<Label>Username</Label>);
      expect(screen.getByText('Username')).toBeInTheDocument();
    });

    it('should render as a label element', () => {
      render(<Label>Email</Label>);
      const label = screen.getByText('Email');
      expect(label.tagName.toLowerCase()).toBe('label');
    });
  });

  describe('className handling', () => {
    it('should apply custom className', () => {
      render(<Label className="custom-label">Name</Label>);
      expect(screen.getByText('Name')).toHaveClass('custom-label');
    });

    it('should merge custom className with default styles', () => {
      render(<Label className="my-class">Test</Label>);
      const label = screen.getByText('Test');
      expect(label).toHaveClass('my-class');
      expect(label).toHaveClass('text-sm');
    });
  });

  describe('htmlFor attribute', () => {
    it('should support htmlFor attribute', () => {
      render(<Label htmlFor="username-input">Username</Label>);
      expect(screen.getByText('Username')).toHaveAttribute('for', 'username-input');
    });

    it('should associate with input when htmlFor matches', () => {
      render(
        <>
          <Label htmlFor="email-input">Email</Label>
          <input id="email-input" type="email" />
        </>
      );
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });
  });

  describe('ref forwarding', () => {
    it('should forward ref to label element', () => {
      const ref = { current: null };
      render(<Label ref={ref}>Reference Test</Label>);
      expect(ref.current).toBeInstanceOf(HTMLLabelElement);
    });
  });

  describe('props forwarding', () => {
    it('should forward data attributes', () => {
      render(<Label data-testid="label-test">Test</Label>);
      expect(screen.getByTestId('label-test')).toBeInTheDocument();
    });

    it('should forward aria attributes', () => {
      render(<Label aria-describedby="hint">Described Label</Label>);
      expect(screen.getByText('Described Label')).toHaveAttribute('aria-describedby', 'hint');
    });

    it('should support id attribute', () => {
      render(<Label id="my-label">ID Label</Label>);
      expect(screen.getByText('ID Label')).toHaveAttribute('id', 'my-label');
    });
  });

  describe('styling', () => {
    it('should have default text-sm class', () => {
      render(<Label>Styled</Label>);
      expect(screen.getByText('Styled')).toHaveClass('text-sm');
    });

    it('should have font-medium class', () => {
      render(<Label>Font Test</Label>);
      expect(screen.getByText('Font Test')).toHaveClass('font-medium');
    });
  });

  describe('composition', () => {
    it('should render with form input', () => {
      render(
        <div>
          <Label htmlFor="test-input">Test Label</Label>
          <input id="test-input" />
        </div>
      );
      expect(screen.getByText('Test Label')).toBeInTheDocument();
      expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
    });

    it('should render nested content', () => {
      render(
        <Label>
          <span>Required</span>
          <span>*</span>
        </Label>
      );
      expect(screen.getByText('Required')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
    });
  });
});
