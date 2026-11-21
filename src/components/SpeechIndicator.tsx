import { cn } from "@/utils/utils";

export type SpeechIndicatorProps = {
  levels: number[];
  className?: string;
  barClassName?: string;
};

const MIN_HEIGHT = 3;
const MAX_HEIGHT = 22;

export default function SpeechIndicator({
  levels,
  className,
  barClassName = "bg-white",
}: SpeechIndicatorProps) {
  return (
    <div
      className={cn("flex items-center justify-center gap-1", className)}
      style={{ height: MAX_HEIGHT }}
    >
      {levels.map((level, index) => (
        <span
          key={index}
          className={cn(
            "w-1 rounded-full transition-[height] duration-100 ease-out",
            barClassName,
          )}
          style={{
            height: MIN_HEIGHT + level * (MAX_HEIGHT - MIN_HEIGHT),
          }}
        />
      ))}
    </div>
  );
}
