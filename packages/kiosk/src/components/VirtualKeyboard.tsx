import { useKioskStore } from '../store/kiosk';

interface VirtualKeyboardProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

export function VirtualKeyboard({ onKeyPress, onBackspace, onClear }: VirtualKeyboardProps) {
  const touch = useKioskStore((s) => s.touch);

  const handleKey = (key: string) => {
    touch();
    onKeyPress(key);
  };

  const handleBackspace = () => {
    touch();
    onBackspace();
  };

  const handleClear = () => {
    touch();
    onClear();
  };

  const handleSpace = () => {
    touch();
    onKeyPress(' ');
  };

  return (
    <div className="bg-el-dark border-t border-el-gray px-3 py-4 space-y-2">
      {/* Row 1 */}
      <div className="flex justify-center gap-1.5">
        {ROWS[0].map((key) => (
          <button
            key={key}
            onClick={() => handleKey(key)}
            className="flex-1 max-w-[60px] h-12 bg-el-gray rounded-lg text-el-light font-bold text-base active:scale-[0.95] active:bg-el-gray-light transition-transform"
          >
            {key}
          </button>
        ))}
      </div>

      {/* Row 2 */}
      <div className="flex justify-center gap-1.5">
        <div className="w-4" />
        {ROWS[1].map((key) => (
          <button
            key={key}
            onClick={() => handleKey(key)}
            className="flex-1 max-w-[60px] h-12 bg-el-gray rounded-lg text-el-light font-bold text-base active:scale-[0.95] active:bg-el-gray-light transition-transform"
          >
            {key}
          </button>
        ))}
        <div className="w-4" />
      </div>

      {/* Row 3 with backspace */}
      <div className="flex justify-center gap-1.5">
        <div className="w-4" />
        {ROWS[2].map((key) => (
          <button
            key={key}
            onClick={() => handleKey(key)}
            className="flex-1 max-w-[60px] h-12 bg-el-gray rounded-lg text-el-light font-bold text-base active:scale-[0.95] active:bg-el-gray-light transition-transform"
          >
            {key}
          </button>
        ))}
        <button
          onClick={handleBackspace}
          className="flex-[1.5] max-w-[90px] h-12 bg-el-gray-light rounded-lg text-el-light font-bold text-sm active:scale-[0.95] active:bg-el-blue transition-transform flex items-center justify-center"
          aria-label="Backspace"
        >
          &#x232B;
        </button>
      </div>

      {/* Bottom row: clear + space */}
      <div className="flex justify-center gap-1.5">
        <button
          onClick={handleClear}
          className="flex-[1.5] max-w-[120px] h-12 bg-el-gray-light rounded-lg text-el-light font-bold text-sm active:scale-[0.95] active:bg-el-blue transition-transform"
        >
          Clear
        </button>
        <button
          onClick={handleSpace}
          className="flex-[4] h-12 bg-el-gray rounded-lg text-el-light font-bold text-sm active:scale-[0.95] active:bg-el-gray-light transition-transform"
        >
          Space
        </button>
      </div>
    </div>
  );
}
