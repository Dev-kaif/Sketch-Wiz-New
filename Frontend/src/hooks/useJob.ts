"use client";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export const useCreateJob = () => {
    const trpc = useTRPC();
    return useMutation(
        trpc.job.create.mutationOptions({
            onError: () => toast.error("Failed to start image generation"),
        })
    );
};

export const usePollJob = (jobId: string | null) => {
    const trpc = useTRPC();
    return useQuery({
        ...trpc.job.getStatus.queryOptions({ jobId: jobId! }),
        enabled: !!jobId,
        staleTime: 0,
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            if (status === "done" || status === "failed") return false;
            return 3000;
        },
    });
};