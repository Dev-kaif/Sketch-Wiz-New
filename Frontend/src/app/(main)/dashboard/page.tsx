"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, LogOut, Trash2, ArrowRight, Copy, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    useGetRooms,
    useCreateRoom,
    useJoinRoom,
    useJoinByInvite,
    useDeleteRoom,
} from "@/hooks/useRoom";
import { authClient } from "@/lib/auth-client";

export default function DashboardPage() {
    const router = useRouter();

    const { data: roomsData, isLoading } = useGetRooms();
    const createRoom = useCreateRoom();
    const joinRoom = useJoinRoom();
    const joinByInvite = useJoinByInvite();
    const deleteRoom = useDeleteRoom();

    const [createSlug, setCreateSlug] = useState("");
    const [createPassword, setCreatePassword] = useState("");
    const [joinSlug, setJoinSlug] = useState("");
    const [joinPassword, setJoinPassword] = useState("");
    const [inviteToken, setInviteToken] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [joinOpen, setJoinOpen] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);

    const handleCreateRoom = async () => {
        if (!createSlug.trim()) return;
        await createRoom.mutateAsync({
            slug: createSlug.trim(),
            password: createPassword || undefined,
        });
        setCreateSlug("");
        setCreatePassword("");
        setCreateOpen(false);
    };

    const handleJoinRoom = async () => {
        if (!joinSlug.trim()) return;
        const { room } = await joinRoom.mutateAsync({
            slug: joinSlug.trim(),
            password: joinPassword || undefined,
        });
        router.push(`/room/${room.slug}`);
    };

    const handleJoinByInvite = async () => {
        if (!inviteToken.trim()) return;
        const { room } = await joinByInvite.mutateAsync({
            inviteToken: inviteToken.trim(),
        });
        router.push(`/room/${room.slug}`);
    };

    const handleDeleteRoom = async (roomId: number) => {
        await deleteRoom.mutateAsync({ roomId });
    };

    const copyInviteLink = (token: string) => {
        const url = `${window.location.origin}/invite/${token}`;
        navigator.clipboard.writeText(url);
        toast.success("Invite link copied!");
    };

    const handleSignOut = async () => {
        await authClient.signOut();
        router.push("/signin");
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            {/* Header */}
            <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
                <h1 className="text-xl font-bold">SketchWiz</h1>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    className="text-zinc-400 hover:text-white"
                >
                    <LogOut size={16} className="mr-2" />
                    Sign Out
                </Button>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-8">
                {/* Actions */}
                <div className="flex items-center gap-3 mb-8">
                    {/* Create Room */}
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-indigo-600 hover:bg-indigo-700">
                                <Plus size={16} className="mr-2" />
                                New Room
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-900 border-zinc-700 text-white">
                            <DialogHeader>
                                <DialogTitle>Create Room</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 mt-2">
                                <div>
                                    <Label className="mb-1 block">Room Name</Label>
                                    <Input
                                        placeholder="my-room"
                                        value={createSlug}
                                        onChange={(e) => setCreateSlug(e.target.value)}
                                        className="bg-zinc-800 border-zinc-700"
                                    />
                                </div>
                                <div>
                                    <Label className="mb-1 block">
                                        Password{" "}
                                        <span className="text-zinc-500 text-xs">
                                            (optional — leave blank for invite-only)
                                        </span>
                                    </Label>
                                    <Input
                                        type="password"
                                        placeholder="••••••"
                                        value={createPassword}
                                        onChange={(e) => setCreatePassword(e.target.value)}
                                        className="bg-zinc-800 border-zinc-700"
                                    />
                                </div>
                                <Button
                                    onClick={handleCreateRoom}
                                    disabled={createRoom.isPending}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                                >
                                    {createRoom.isPending ? "Creating..." : "Create"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Join by slug */}
                    <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-zinc-700 text-white hover:bg-zinc-800">
                                Join Room
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-900 border-zinc-700 text-white">
                            <DialogHeader>
                                <DialogTitle>Join Room</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 mt-2">
                                <div>
                                    <Label className="mb-1 block">Room Name</Label>
                                    <Input
                                        placeholder="my-room"
                                        value={joinSlug}
                                        onChange={(e) => setJoinSlug(e.target.value)}
                                        className="bg-zinc-800 border-zinc-700"
                                    />
                                </div>
                                <div>
                                    <Label className="mb-1 block">Password</Label>
                                    <Input
                                        type="password"
                                        placeholder="••••••"
                                        value={joinPassword}
                                        onChange={(e) => setJoinPassword(e.target.value)}
                                        className="bg-zinc-800 border-zinc-700"
                                    />
                                </div>
                                <Button
                                    onClick={handleJoinRoom}
                                    disabled={joinRoom.isPending}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                                >
                                    {joinRoom.isPending ? "Joining..." : "Join"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Join by invite */}
                    <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-zinc-700 text-white hover:bg-zinc-800">
                                <Link size={16} className="mr-2" />
                                Use Invite Link
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-900 border-zinc-700 text-white">
                            <DialogHeader>
                                <DialogTitle>Join via Invite</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 mt-2">
                                <div>
                                    <Label className="mb-1 block">Invite Token</Label>
                                    <Input
                                        placeholder="paste token here"
                                        value={inviteToken}
                                        onChange={(e) => setInviteToken(e.target.value)}
                                        className="bg-zinc-800 border-zinc-700"
                                    />
                                </div>
                                <Button
                                    onClick={handleJoinByInvite}
                                    disabled={joinByInvite.isPending}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                                >
                                    {joinByInvite.isPending ? "Joining..." : "Join"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Rooms Grid */}
                {isLoading ? (
                    <div className="text-zinc-500 text-sm">Loading rooms...</div>
                ) : roomsData?.rooms.length === 0 ? (
                    <div className="text-center py-20 text-zinc-500">
                        <p className="text-lg mb-2">No rooms yet</p>
                        <p className="text-sm">Create or join a room to get started</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {roomsData?.rooms.map((room) => (
                            <Card
                                key={room.id}
                                className="bg-zinc-900 border-zinc-700 text-white"
                            >
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base font-semibold">
                                        {room.slug}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pb-2">
                                    <p className="text-xs text-zinc-500">
                                        Created{" "}
                                        {new Date(room.createdAt).toLocaleDateString()}
                                    </p>
                                    <p className="text-xs text-zinc-500 mt-1">
                                        {room.passwordHash
                                            ? "🔒 Password protected"
                                            : "🔗 Invite only"}
                                    </p>
                                </CardContent>
                                <CardFooter className="flex items-center gap-2 pt-0">
                                    <Button
                                        size="sm"
                                        onClick={() => router.push(`/room/${room.slug}`)}
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-xs"
                                    >
                                        Open
                                        <ArrowRight size={12} className="ml-1" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => copyInviteLink(room.inviteToken)}
                                        className="text-zinc-400 hover:text-white"
                                    >
                                        <Copy size={14} />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDeleteRoom(room.id)}
                                        className="text-red-400 hover:text-red-300"
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}