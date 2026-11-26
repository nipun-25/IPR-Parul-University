import React from 'react';
import './globals.css';
import { PRE_HYDRATION_TOKEN_SCRUBBER_SCRIPT } from '../utils/token-scrubber';

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
      <head>
        <script
          id="pre-hydration-token-scrubber"
          dangerouslySetInnerHTML={{ __html: PRE_HYDRATION_TOKEN_SCRUBBER_SCRIPT }}
        />
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
