// Over-engineering is fun!

import { useEffect, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";

export interface StackedGridProps extends React.HTMLAttributes<HTMLDivElement> {
  items: React.ReactNode[];
}

export function StackedGrid(props: StackedGridProps) {
  const { items, className, ...rest } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [batches, setBatches] = useState([] as React.ReactNode[][]);

  function splitIntoColumns(
    items: React.ReactNode[],
    columns: number,
  ): React.ReactNode[][] {
    const result: React.ReactNode[][] = Array.from(
      { length: columns },
      () => [],
    );
    items.forEach((item, index) => {
      result[index % columns].push(item);
    });
    return result;
  }

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.getBoundingClientRect().width;
      console.log("Container width:", width);
      const columnCount = width > 700 ? Math.floor(width / 300) : 1;
      const newBatches = splitIntoColumns(items, columnCount);
      setBatches(newBatches);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, items);

  return (
    <div
      className={twMerge("flex w-full justify-center gap-2", className)}
      ref={containerRef}
      {...rest}
    >
      {batches
        .filter((batch) => batch.length > 0)
        .map((batch, batchIndex) => (
          <div
            key={batchIndex}
            className={twMerge(
              "flex flex-col gap-2",
              items.length > batches.length && "flex-1",
            )}
          >
            {batch.map((item, itemIndex) => (
              <div key={itemIndex}>{item}</div>
            ))}
          </div>
        ))}
    </div>
  );
}
