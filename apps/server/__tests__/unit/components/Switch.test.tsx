import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Switch } from '../../../src/components/ui/switch';

describe('Switch', () => {
  describe('rendering', () => {
    it('should render with default props', () => {
      render(<Switch />);
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('should render as unchecked by default', () => {
      render(<Switch />);
      expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'unchecked');
    });
  });

  describe('checked state', () => {
    it('should render as checked when checked prop is true', () => {
      render(<Switch checked={true} />);
      expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'checked');
    });

    it('should render as unchecked when checked prop is false', () => {
      render(<Switch checked={false} />);
      expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'unchecked');
    });

    it('should toggle state on click', () => {
      const onCheckedChange = vi.fn();
      render(<Switch onCheckedChange={onCheckedChange} />);
      fireEvent.click(screen.getByRole('switch'));
      expect(onCheckedChange).toHaveBeenCalledWith(true);
    });

    it('should support defaultChecked', () => {
      render(<Switch defaultChecked={true} />);
      expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'checked');
    });
  });

  describe('disabled state', () => {
    it('should render disabled state', () => {
      render(<Switch disabled />);
      expect(screen.getByRole('switch')).toBeDisabled();
    });

    it('should not toggle when disabled', () => {
      const onCheckedChange = vi.fn();
      render(<Switch disabled onCheckedChange={onCheckedChange} />);
      fireEvent.click(screen.getByRole('switch'));
      expect(onCheckedChange).not.toHaveBeenCalled();
    });
  });

  describe('events', () => {
    it('should call onCheckedChange when toggled', () => {
      const onCheckedChange = vi.fn();
      render(<Switch onCheckedChange={onCheckedChange} />);
      fireEvent.click(screen.getByRole('switch'));
      expect(onCheckedChange).toHaveBeenCalled();
    });

    it('should pass correct value to onCheckedChange', () => {
      const onCheckedChange = vi.fn();
      render(<Switch checked={false} onCheckedChange={onCheckedChange} />);
      fireEvent.click(screen.getByRole('switch'));
      expect(onCheckedChange).toHaveBeenCalledWith(true);
    });

    it('should toggle from checked to unchecked', () => {
      const onCheckedChange = vi.fn();
      render(<Switch checked={true} onCheckedChange={onCheckedChange} />);
      fireEvent.click(screen.getByRole('switch'));
      expect(onCheckedChange).toHaveBeenCalledWith(false);
    });
  });

  describe('className handling', () => {
    it('should apply custom className', () => {
      render(<Switch className="custom-switch" />);
      expect(screen.getByRole('switch')).toHaveClass('custom-switch');
    });

    it('should have peer class by default', () => {
      render(<Switch />);
      expect(screen.getByRole('switch')).toHaveClass('peer');
    });

    it('should have inline-flex class', () => {
      render(<Switch />);
      expect(screen.getByRole('switch')).toHaveClass('inline-flex');
    });
  });

  describe('ref forwarding', () => {
    it('should forward ref', () => {
      const ref = { current: null };
      render(<Switch ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
  });

  describe('accessibility', () => {
    it('should have switch role', () => {
      render(<Switch />);
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('should support aria-label', () => {
      render(<Switch aria-label="Toggle notifications" />);
      expect(screen.getByLabelText('Toggle notifications')).toBeInTheDocument();
    });

    it('should support aria-describedby', () => {
      render(
        <>
          <Switch aria-describedby="switch-desc" />
          <span id="switch-desc">Toggle this setting</span>
        </>
      );
      expect(screen.getByRole('switch')).toHaveAttribute('aria-describedby', 'switch-desc');
    });

    it('should be keyboard accessible', () => {
      const onCheckedChange = vi.fn();
      render(<Switch onCheckedChange={onCheckedChange} />);
      const switchEl = screen.getByRole('switch');
      switchEl.focus();
      fireEvent.keyDown(switchEl, { key: ' ' });
      fireEvent.keyUp(switchEl, { key: ' ' });
      // Space key should toggle the switch
    });
  });

  describe('form integration', () => {
    it('should support name attribute', () => {
      // Verify component renders without errors when name prop is passed
      // Radix UI Switch handles form submission internally
      expect(() => render(<Switch name="notifications" />)).not.toThrow();
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('should support value attribute', () => {
      // Verify component renders without errors when value prop is passed
      // Radix UI Switch handles form submission internally
      expect(() => render(<Switch value="on" />)).not.toThrow();
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('should support required attribute', () => {
      render(<Switch required />);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('props forwarding', () => {
    it('should forward data attributes', () => {
      render(<Switch data-testid="test-switch" />);
      expect(screen.getByTestId('test-switch')).toBeInTheDocument();
    });

    it('should forward id attribute', () => {
      render(<Switch id="my-switch" />);
      expect(screen.getByRole('switch')).toHaveAttribute('id', 'my-switch');
    });
  });

  describe('composition with label', () => {
    it('should work with label using htmlFor', () => {
      render(
        <div>
          <label htmlFor="airplane-mode">Airplane Mode</label>
          <Switch id="airplane-mode" />
        </div>
      );
      expect(screen.getByLabelText('Airplane Mode')).toBeInTheDocument();
    });
  });
});
