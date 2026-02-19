
"use client";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export const useSolveCanvas = () => {
    const trpc = useTRPC();
    return useMutation(
        trpc.ai.solve.mutationOptions({
            onError: () => toast.error("AI solve failed"),
        })
    );
};