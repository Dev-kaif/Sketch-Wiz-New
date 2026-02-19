"use client";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useGetRooms = () => {
    const trpc = useTRPC();
    return useQuery(trpc.room.getAll.queryOptions());
};

export const useGetRoomBySlug = (slug: string) => {
    const trpc = useTRPC();
    return useQuery(trpc.room.getBySlug.queryOptions({ slug }));
};

export const useCreateRoom = () => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    return useMutation(
        trpc.room.create.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries(trpc.room.getAll.queryOptions());
                toast.success("Room created!");
            },
            onError: (err) => {
                toast.error(err.message ?? "Failed to create room");
            },
        })
    );
};

export const useJoinRoom = () => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    return useMutation(
        trpc.room.join.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries(trpc.room.getAll.queryOptions());
            },
            onError: (err) => {
                toast.error(err.message ?? "Failed to join room");
            },
        })
    );
};

export const useJoinByInvite = () => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    return useMutation(
        trpc.room.joinByInvite.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries(trpc.room.getAll.queryOptions());
            },
            onError: (err) => {
                toast.error(err.message ?? "Failed to join via invite");
            },
        })
    );
};

export const useDeleteRoom = () => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    return useMutation(
        trpc.room.delete.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries(trpc.room.getAll.queryOptions());
                toast.success("Room deleted");
            },
            onError: (err) => {
                toast.error(err.message ?? "Failed to delete room");
            },
        })
    );
};

export const useClearCanvas = () => {
    const trpc = useTRPC();
    return useMutation(
        trpc.room.clearCanvas.mutationOptions({
            onSuccess: () => toast.success("Canvas cleared"),
            onError: (err) => toast.error(err.message ?? "Failed to clear canvas"),
        })
    );
};


export const useWSToken = () => {
    const trpc = useTRPC();

    return useQuery(
        trpc.room.wsToken.queryOptions()
    );
};
