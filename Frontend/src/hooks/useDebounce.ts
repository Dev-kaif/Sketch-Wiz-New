import { useRef, useCallback } from "react";

export function useDebouncedCallback<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): T {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    return useCallback((...args: Parameters<T>) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            fn(...args);
        }, delay);
    }, [fn, delay]) as T;
}