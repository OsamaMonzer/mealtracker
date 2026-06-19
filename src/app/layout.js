import './globals.css';
import ToastContainer from '../components/ToastContainer';

export const metadata = {
  title: "Osama's Kitchen",
  description: 'Personal Nutrition & Recipe System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          {children}
        </div>
        <ToastContainer />
      </body>
    </html>
  );
}
