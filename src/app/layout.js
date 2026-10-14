import './globals.css';
import ToastContainer from '../components/ToastContainer';

export const metadata = {
  title: "Osama's Kitchen",
  description: 'Personal Nutrition & Recipe System',
  icons: { icon: '/favicon.svg' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: "Osama's Kitchen",
  },
};

// Pinch-zoom stays enabled for accessibility. Inputs use 16px+ text, which stops iOS auto-zoom.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Osama's Kitchen" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <div className="app-container">
          {children}
        </div>
        <ToastContainer />
      </body>
    </html>
  );
}
