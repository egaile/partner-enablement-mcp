export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth pages render without the sidebar/topbar
  return <>{children}</>;
}
