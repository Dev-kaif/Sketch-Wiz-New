"use client";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export const useSaveChat = () => {
    const trpc = useTRPC();
    return useMutation(
        trpc.chat.save.mutationOptions({
            onError: () => toast.error("Failed to save message"),
        })
    );
};