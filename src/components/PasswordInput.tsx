import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/** Pole hasła z przyciskiem „pokaż / ukryj”, żeby dziecko mogło sprawdzić, co wpisało. */
export function PasswordInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative w-full">
      <input {...props} type={visible ? 'text' : 'password'} className={`${className} pr-11`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ukryj hasło' : 'Pokaż hasło'}
        aria-pressed={visible}
        className="absolute right-0 top-0 h-full min-w-[44px] flex items-center justify-center text-[var(--th-text-muted)] hover:text-[var(--th-text)] cursor-pointer"
      >
        {visible ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
      </button>
    </div>
  );
}
