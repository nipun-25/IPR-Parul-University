import React from 'react';
import './globals.css';

export const metadata = {
  title: 'Parul University IPR Portal',
  description: 'Intellectual Property Rights and Disclosure Management Portal'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
