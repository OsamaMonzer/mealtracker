import './globals.css';
import ToastContainer from '../components/ToastContainer';
import { currentKitchenName } from '../lib/currentKitchenName';

export const dynamic = 'force-dynamic';

// Title follows the signed-in user: "Osama's Kitchen", "Sara's Kitchen", …
// iOS uses it as the name under the icon when they "Add to Home Screen".
export async function generateMetadata() {
  const name = await currentKitchenName();
  return {
    title: name,
    description: 'Personal Nutrition & Recipe System',
    icons: { icon: '/favicon.svg', apple: '/favicon.svg' },
    appleWebApp: { capable: true, statusBarStyle: 'default', title: name },
  };
}

// Pinch-zoom stays enabled for accessibility. Inputs use 16px+ text, which stops iOS auto-zoom.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* use-credentials so the browser sends the login cookie and gets the personal app name */}
        <link rel="manifest" href="/manifest.json" crossOrigin="use-credentials" />
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
