import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'LogisticsPro | Last-Mile Delivery Operations Console',
  description: 'Deterministic pricing, zone-based dispatching, and immutable tracking system.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#F7F5F2] text-gray-900 font-sans antialiased selection:bg-blue-600 selection:text-white min-h-screen flex flex-col">
        <AuthProvider>
          <Navbar />
          <div className="flex-1 w-full">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
