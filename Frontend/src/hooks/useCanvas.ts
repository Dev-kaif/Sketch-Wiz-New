"use client";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export const useGetCanvas = (roomId: number) => {
    const trpc = useTRPC();
    return useQuery({
        ...trpc.canvas.get.queryOptions({ roomId }),
        enabled: !!roomId,
        staleTime: Infinity,
    });
};

export const useSaveCanvas = () => {
    const trpc = useTRPC();
    return useMutation(
        trpc.canvas.save.mutationOptions({
            onError: () => toast.error("Failed to save canvas"),
        })
    );
};