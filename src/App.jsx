import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AlertTriangle, Download } from 'lucide-react'; // Icons for prompt

// Core Components & Pages
import Header from "./components/Header";
import Footer from "./components/Footer";
import Home from "./Home"; // Main view when connected
import Home2 from "./pages/Home2"; // Landing/Connect view when disconnected
import Explore from "./pages/Explore.jsx";
import PropertyInfo from "./pages/PropertyInfo";
import Dashboard from "./pages/Dashboard";
import PropertyForm from "./pages/PropertyForm";
import Editproperty from "./pages/Editproperty";
// <-- IMPORT PurchasePage if you have it -->

import ChatPage from "./pages/Chatpage.jsx"; // Verify filename case sensitivity
import MakeOffer from "./components/MakeOffer.jsx";
import AboutPage from "./pages/AboutPage";

// Context & Services
import { useWallet } from './pages/WalletContext'; // Verify path
// Supabase import not strictly needed in App.js if handled elsewhere, but keep if used directly
// import { supabase } from "./../supabase";

function App() {
    // Use state from WalletContext
    const { address, connectWallet, loading: walletLoading, error: walletError } = useWallet();
    const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(true); // Assume installed initially
    // notificationCount state can remain if used
    const [notificationCount, setNotificationCount] = useState(0);

    // Effect to check MetaMask installation ONCE on component mount
    useEffect(() => {
        // Check immediately
        if (typeof window.ethereum === 'undefined' || !window.ethereum.isMetaMask) {
            console.log("MetaMask is not installed.");
            setIsMetaMaskInstalled(false);
        } else {
             console.log("MetaMask is installed.");
             setIsMetaMaskInstalled(true);

             // Optional: Listen for account changes to potentially update state if needed
             // This is often handled *within* the WalletContext itself, but good to be aware of
             const handleAccountsChanged = (accounts) => {
                console.log("App.js detected accountsChanged:", accounts);
                // The WalletContext should handle updating the 'address' state
                // If not, you might need logic here, but ideally context manages it.
                if (accounts.length === 0) {
                    console.log("Wallet disconnected in App.js listener");
                    // Context should set address to null
                } else {
                    // Context should set address to accounts[0]
                }
             };

             window.ethereum.on('accountsChanged', handleAccountsChanged);

             // Cleanup listener on component unmount
             return () => {
                if (window.ethereum?.removeListener) { // Check for removeListener
                     window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                }
             };
        }
    }, []); // Empty dependency array ensures this runs only once on mount


    // --- RENDER STATE 1: METAMASK NOT INSTALLED ---
    if (!isMetaMaskInstalled) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-red-100 to-orange-100 text-gray-800 p-6">
                 <AlertTriangle className="w-16 h-16 text-red-500 mb-6" />
                <h1 className="text-3xl font-bold mb-4 text-center">MetaMask Required</h1>
                <p className="text-lg text-center mb-8 max-w-md">
                    To use this decentralized application, you need the MetaMask browser extension.
                </p>
                <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors duration-200"
                >
                    <Download className="w-5 h-5" />
                    Install MetaMask
                </a>
                <p className="text-sm text-gray-600 mt-6">
                    Refresh this page after installation.
                </p>
            </div>
        );
    }

    // WalletContext handles loading/error states internally usually,
    // but you could add a global loading indicator here if desired:
    // if (walletLoading) {
    //    return <div>Loading Wallet...</div>;
    // }

    // --- RENDER STATE 2 & 3: METAMASK INSTALLED (Router handles connected/disconnected) ---
    return (
        <Router>
            <div className="flex flex-col min-h-screen">
                {/* Header remains, gets connection status and function from context */}
                <Header
                    notificationCount={notificationCount}
                    isConnected={!!address} // Status based on context address
                    connectWallet={connectWallet} // Pass context connect function
                    walletAddress={address} // Pass context address
                />

                 {/* Display Wallet Error from Context if any */}
                 {walletError && (
                     <div style={{ color: 'red', background: '#ffebee', padding: '10px', textAlign: 'center', borderBottom: '1px solid #ffcdd2' }}>
                         Wallet Error: {walletError}
                     </div>
                 )}

                <main className="flex-grow">
                    <Routes>
                        {/* --- Conditional Root Route --- */}
                        {/* If connected (address exists), show Home. */}
                        {/* If not connected, show Home2 and pass the connect function */}
                        <Route
                            path="/"
                            element={
                                address ? (
                                    <Home />
                                ) : (
                                    <Home2 connectWithMetamask={connectWallet} /> // Pass connect function here
                                )
                            }
                        />

                        {/* --- Protected Routes --- */}
                        {/* Redirect to '/' if address is null. '/' will then render Home2. */}
                        <Route path="/explore" element={address ? <Explore /> : <Navigate to="/" replace />} />
                        <Route path="/property/:id" element={address ? <PropertyInfo /> : <Navigate to="/" replace />} />
                        <Route path="/dashboard" element={address ? <Dashboard /> : <Navigate to="/" replace />} />
                        <Route path="/make-offer" element={address ? <MakeOffer /> : <Navigate to="/" replace />} />
                        <Route path="/chat" element={address ? <ChatPage /> : <Navigate to="/" replace />} />
                        <Route path="/propertyform" element={address ? <PropertyForm /> : <Navigate to="/" replace />} />
                        <Route path="/edit-property/:productId" element={address ? <Editproperty /> : <Navigate to="/" replace />} />
                        {/* Add PurchasePage route here if needed, also protected */}
                        {/* <Route path="/purchase/:id" element={address ? <PurchasePage /> : <Navigate to="/" replace />} /> */}

                        {/* --- Public Routes --- */}
                        {/* These are accessible regardless of connection status */}
                        <Route path="/about" element={<AboutPage />} />

                        {/* --- Catch-all Route --- */}
                        {/* Redirects any invalid path back to the root */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
                <Footer />
            </div>
        </Router>
    );
}

export default App;