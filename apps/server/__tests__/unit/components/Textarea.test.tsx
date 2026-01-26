import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Textarea } from '../../../src/components/ui/textarea';

describe('Textarea', () => {
  describe('rendering', () => {
    it('should render with default props', () => {
      render(<Textarea />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should render as a textarea element', () => {
      render(<Textarea data-testid="test-textarea" />);
      const textarea = screen.getByTestId('test-textarea');
      expect(textarea.tagName.toLowerCase()).toBe('textarea');
    });

    it('should apply custom className', () => {
      render(<Textarea className="custom-class" />);
      expect(screen.getByRole('textbox')).toHaveClass('custom-class');
    });

    it('should render with placeholder', () => {
      render(<Textarea placeholder="Enter your message" />);
      expect(screen.getByPlaceholderText('Enter your message')).toBeInTheDocument();
    });
  });

  describe('value handling', () => {
    it('should render with initial value', () => {
      render(<Textarea defaultValue="initial text" />);
      expect(screen.getByRole('textbox')).toHaveValue('initial text');
    });

    it('should update value on change', () => {
      render(<Textarea />);
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'new value' } });
      expect(textarea).toHaveValue('new value');
    });

    it('should support controlled value', () => {
      const { rerender } = render(<Textarea value="controlled" onChange={() => {}} />);
      expect(screen.getByRole('textbox')).toHaveValue('controlled');
      rerender(<Textarea value="updated" onChange={() => {}} />);
      expect(screen.getByRole('textbox')).toHaveValue('updated');
    });
  });

  describe('states', () => {
    it('should render disabled state', () => {
      render(<Textarea disabled />);
      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('should render readonly state', () => {
      render(<Textarea readOnly />);
      expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    });

    it('should render required state', () => {
      render(<Textarea required />);
      expect(screen.getByRole('textbox')).toBeRequired();
    });
  });

  describe('events', () => {
    it('should call onChange handler', () => {
      const onChange = vi.fn();
      render(<Textarea onChange={onChange} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
      expect(onChange).toHaveBeenCalled();
    });

    it('should call onFocus handler', () => {
      const onFocus = vi.fn();
      render(<Textarea onFocus={onFocus} />);
      fireEvent.focus(screen.getByRole('textbox'));
      expect(onFocus).toHaveBeenCalled();
    });

    it('should call onBlur handler', () => {
      const onBlur = vi.fn();
      render(<Textarea onBlur={onBlur} />);
      fireEvent.blur(screen.getByRole('textbox'));
      expect(onBlur).toHaveBeenCalled();
    });

    it('should call onKeyDown handler', () => {
      const onKeyDown = vi.fn();
      render(<Textarea onKeyDown={onKeyDown} />);
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
      expect(onKeyDown).toHaveBeenCalled();
    });
  });

  describe('ref forwarding', () => {
    it('should forward ref to textarea element', () => {
      const ref = vi.fn();
      render(<Textarea ref={ref} />);
      expect(ref).toHaveBeenCalled();
    });

    it('should ref be HTMLTextAreaElement', () => {
      const ref = { current: null };
      render(<Textarea ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    });
  });

  describe('attributes', () => {
    it('should support rows attribute', () => {
      render(<Textarea rows={10} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('rows', '10');
    });

    it('should support cols attribute', () => {
      render(<Textarea cols={50} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('cols', '50');
    });

    it('should support maxLength attribute', () => {
      render(<Textarea maxLength={500} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '500');
    });

    it('should support minLength attribute', () => {
      render(<Textarea minLength={10} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('minLength', '10');
    });

    it('should support name attribute', () => {
      render(<Textarea name="message" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('name', 'message');
    });

    it('should support id attribute', () => {
      render(<Textarea id="textarea-id" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('id', 'textarea-id');
    });
  });

  describe('accessibility', () => {
    it('should support aria-label', () => {
      render(<Textarea aria-label="Message input" />);
      expect(screen.getByLabelText('Message input')).toBeInTheDocument();
    });

    it('should support aria-describedby', () => {
      render(
        <>
          <Textarea aria-describedby="help-text" />
          <span id="help-text">Enter your message here</span>
        </>
      );
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'help-text');
    });

    it('should support aria-invalid', () => {
      render(<Textarea aria-invalid="true" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });

    it('should support aria-required', () => {
      render(<Textarea aria-required="true" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('styling', () => {
    it('should have min-h-[80px] class', () => {
      render(<Textarea />);
      expect(screen.getByRole('textbox')).toHaveClass('min-h-[80px]');
    });

    it('should have w-full class', () => {
      render(<Textarea />);
      expect(screen.getByRole('textbox')).toHaveClass('w-full');
    });

    it('should have rounded-md class', () => {
      render(<Textarea />);
      expect(screen.getByRole('textbox')).toHaveClass('rounded-md');
    });
  });

  describe('form integration', () => {
    it('should work within a form', () => {
      const onSubmit = vi.fn((e) => e.preventDefault());
      render(
        <form onSubmit={onSubmit}>
          <Textarea name="comment" defaultValue="Test comment" />
          <button type="submit">Submit</button>
        </form>
      );

      fireEvent.click(screen.getByRole('button'));
      expect(onSubmit).toHaveBeenCalled();
    });
  });
});
