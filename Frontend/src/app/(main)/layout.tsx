import { RequiredAuth } from "@/lib/auth-utils";

export default async function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {

    await RequiredAuth()

    return <>{children}</>;
}